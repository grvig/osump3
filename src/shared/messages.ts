import type { TagOptions } from "../core/tagging";

export type Stage = "fetching" | "unzipping" | "tagging" | "saving" | "saved" | "failed";

// Sent from the service worker to the offscreen document through
// Client.postMessage. chrome.runtime messaging serialises to JSON and would
// turn the archive into an empty object, while postMessage can transfer it.
export type OffscreenRequest =
  | { type: "process"; jobId: string; setId: number; data: ArrayBuffer; options: TagOptions }
  | { type: "revoke"; blobUrl: string };

// Sent from the offscreen document back to the service worker. These are
// small, so plain chrome.runtime messaging is fine.
export type OffscreenReply =
  | { target: "background"; type: "stage"; jobId: string; stage: Stage }
  | { target: "background"; type: "processed"; jobId: string; blobUrl: string; filename: string }
  | { target: "background"; type: "process-failed"; jobId: string; error: string };

export type PopupRequest = { target: "background"; type: "download"; setId: number };

// Job progress lives in session storage rather than in messages, so a popup
// that was closed mid-download shows the right state when reopened.
export interface JobStatus {
  stage: Stage;
  detail: string;
}

export function statusKey(setId: number): string {
  return `status:${setId}`;
}