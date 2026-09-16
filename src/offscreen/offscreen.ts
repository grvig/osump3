import { extractOsz, type AudioFormat } from "../core/extract";
import { buildFilename, pickDisplayNames } from "../core/naming";
import { tagMp3 } from "../core/tagging";
import type { OffscreenReply, OffscreenRequest } from "../shared/messages";

// This page exists because service workers cannot call URL.createObjectURL.
// It turns an archive into a blob URL the service worker can hand to
// chrome.downloads, and keeps the blob alive until told to revoke it.

const MIME_TYPES: Record<AudioFormat, string> = {
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  other: "application/octet-stream",
};

function reply(message: OffscreenReply): void {
  chrome.runtime.sendMessage(message);
}

function processArchive(request: Extract<OffscreenRequest, { type: "process" }>): void {
  const { jobId, setId, options } = request;
  try {
    reply({ target: "background", type: "stage", jobId, stage: "unzipping" });
    const extracted = extractOsz(request.data);

    // fflate always inflates into a plain ArrayBuffer, never a shared one.
    let output: BlobPart = extracted.audio as Uint8Array<ArrayBuffer>;
    // ID3 only belongs on mp3. An ogg is saved exactly as it came.
    if (extracted.audioFormat === "mp3") {
      reply({ target: "background", type: "stage", jobId, stage: "tagging" });
      output = tagMp3(extracted, setId, options);
    }

    const names = pickDisplayNames(extracted.metadata, options.scheme);
    const filename = buildFilename(names, setId, extracted.audioExtension);
    const blob = new Blob([output], { type: MIME_TYPES[extracted.audioFormat] });
    const blobUrl = URL.createObjectURL(blob);
    reply({ target: "background", type: "processed", jobId, blobUrl, filename });
  } catch (error) {
    let message = String(error);
    if (error instanceof Error) {
      message = error.message;
    }
    reply({ target: "background", type: "process-failed", jobId, error: message });
  }
}

// Assigning onmessage (rather than addEventListener) also starts delivery of
// any messages the service worker queued before this script ran.
navigator.serviceWorker.onmessage = (event: MessageEvent<OffscreenRequest>) => {
  const request = event.data;
  if (request.type === "process") {
    processArchive(request);
  } else if (request.type === "revoke") {
    URL.revokeObjectURL(request.blobUrl);
  }
};
