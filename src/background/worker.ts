import type { TagOptions } from "../core/tagging";
import type { JobStatus, OffscreenReply, PopupRequest, Stage } from "../shared/messages";
import { recordDownload } from "../shared/history";
import { statusKey } from "../shared/messages";
import { fetchFromChain } from "../sources/chain";
import { catboy } from "../sources/mirrorA";
import { nerinyan } from "../sources/mirrorB";
import { politely, RateLimiter } from "../sources/politeness";
import { handleOffscreenReply, processInOffscreen, revokeInOffscreen } from "./offscreenBridge";

// One limiter for the whole extension, so requests stay serial across sources
// and across downloads started back to back.
const limiter = new RateLimiter();
const sources = [catboy, nerinyan].map((source) => politely(source, limiter));

const DEFAULT_TAG_OPTIONS: TagOptions = { scheme: "unicode", albumMode: "source", albumText: "", embedCover: true };

async function setStatus(setId: number, stage: Stage, detail = ""): Promise<void> {
  const status: JobStatus = { stage, detail };
  await chrome.storage.session.set({ [statusKey(setId)]: status });
}

// Resolves once the download finishes or fails. The blob URL must stay valid
// until then, because the download manager reads from it as it goes.
function waitForDownload(downloadId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const listener = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id !== downloadId || delta.state === undefined) {
        return;
      }
      if (delta.state.current === "complete") {
        chrome.downloads.onChanged.removeListener(listener);
        resolve();
      } else if (delta.state.current === "interrupted") {
        chrome.downloads.onChanged.removeListener(listener);
        reject(new Error(`Download interrupted: ${delta.error?.current ?? "unknown reason"}`));
      }
    };
    chrome.downloads.onChanged.addListener(listener);
    // A small file can finish before the listener above is attached.
    chrome.downloads.search({ id: downloadId }).then(([item]) => {
      if (item !== undefined) {
        listener({ id: downloadId, state: { current: item.state } });
      }
    });
  });
}

// Guards against a double click or a second popup starting the same set twice.
const activeSets = new Set<number>();

async function runDownload(setId: number): Promise<void> {
  if (activeSets.has(setId)) {
    return;
  }
  activeSets.add(setId);
  let blobUrl: string | null = null;
  // The click that wakes the worker must not have its own status swept up.
  await staleSweep;
  try {
    await setStatus(setId, "fetching");
    const { data } = await fetchFromChain(sources, setId, new AbortController().signal);

    const processed = await processInOffscreen(setId, data, DEFAULT_TAG_OPTIONS, (stage) => {
      setStatus(setId, stage);
    });
    blobUrl = processed.blobUrl;

    await setStatus(setId, "saving", processed.filename);
    const downloadId = await chrome.downloads.download({ url: blobUrl, filename: processed.filename });
    await waitForDownload(downloadId);
    await recordDownload(setId, processed.filename);
    await setStatus(setId, "saved", processed.filename);
  } catch (error) {
    let message = String(error);
    if (error instanceof Error) {
      message = error.message;
    }
    await setStatus(setId, "failed", message);
  } finally {
    activeSets.delete(setId);
    // Revoke on failure too, otherwise every failed save leaks the whole file.
    if (blobUrl !== null) {
      await revokeInOffscreen(blobUrl).catch(() => undefined);
    }
  }
}

// A job cannot outlive the service worker that ran it, so anything still in
// progress at startup died with the previous worker. Without this the popup
// would keep its button disabled for the rest of the browser session.
const staleSweep = chrome.storage.session.get(null).then(async (items) => {
  for (const [key, value] of Object.entries(items)) {
    const status = value as JobStatus;
    if (key.startsWith("status:") && status.stage !== "saved" && status.stage !== "failed") {
      await chrome.storage.session.set({ [key]: { stage: "failed", detail: "Interrupted, please try again" } });
    }
  }
});

chrome.runtime.onMessage.addListener((message: PopupRequest | OffscreenReply) => {
  if (message?.target !== "background") {
    return;
  }
  if (message.type === "download") {
    runDownload(message.setId);
  } else {
    handleOffscreenReply(message);
  }
});
