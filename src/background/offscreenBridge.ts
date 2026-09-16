import type { TagOptions } from "../core/tagging";
import type { OffscreenReply, OffscreenRequest, Stage } from "../shared/messages";

interface Processed {
  blobUrl: string;
  filename: string;
}

interface PendingJob {
  onStage: (stage: Stage) => void;
  resolve: (result: Processed) => void;
  reject: (error: Error) => void;
}

// The DOM lib has no service worker typings, and pulling in the WebWorker lib
// clashes with it, so only the part of Clients used here is described.
interface WorkerClients {
  matchAll(options: { includeUncontrolled: boolean }): Promise<Array<{ url: string; postMessage(message: unknown, transfer: Transferable[]): void }>>;
}
const workerClients = (globalThis as unknown as { clients: WorkerClients }).clients;

const OFFSCREEN_PATH = "offscreen.html";
const pending = new Map<string, PendingJob>();
let creating: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  const existing = await chrome.runtime.getContexts({ contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT] });
  if (existing.length > 0) {
    return;
  }
  // Only one offscreen document may exist, so concurrent callers share one create.
  if (creating === null) {
    creating = chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: [chrome.offscreen.Reason.BLOBS],
      justification: "Create blob URLs for extracted audio so they can be downloaded",
    });
  }
  try {
    await creating;
  } finally {
    creating = null;
  }
}

async function postToOffscreen(request: OffscreenRequest, transfer: Transferable[] = []): Promise<void> {
  await ensureOffscreen();
  const url = chrome.runtime.getURL(OFFSCREEN_PATH);
  // The document can take a moment to register as a client after creation.
  for (let attempt = 0; attempt < 40; attempt++) {
    const all = await workerClients.matchAll({ includeUncontrolled: true });
    const client = all.find((candidate) => candidate.url === url);
    if (client !== undefined) {
      client.postMessage(request, transfer);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("The offscreen document did not start");
}

export function processInOffscreen(setId: number, data: ArrayBuffer, options: TagOptions, onStage: (stage: Stage) => void): Promise<Processed> {
  const jobId = crypto.randomUUID();
  return new Promise<Processed>((resolve, reject) => {
    pending.set(jobId, { onStage, resolve, reject });
    postToOffscreen({ type: "process", jobId, setId, data, options }, [data]).catch((error) => {
      pending.delete(jobId);
      reject(error);
    });
  });
}

export function revokeInOffscreen(blobUrl: string): Promise<void> {
  return postToOffscreen({ type: "revoke", blobUrl });
}

// Returns true when the message was an offscreen reply and has been handled.
export function handleOffscreenReply(message: OffscreenReply): boolean {
  const job = pending.get(message.jobId);
  if (job === undefined) {
    return false;
  }
  if (message.type === "stage") {
    job.onStage(message.stage);
  } else if (message.type === "processed") {
    pending.delete(message.jobId);
    job.resolve({ blobUrl: message.blobUrl, filename: message.filename });
  } else {
    pending.delete(message.jobId);
    job.reject(new Error(message.error));
  }
  return true;
}
