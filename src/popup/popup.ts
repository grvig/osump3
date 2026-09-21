import { parseBeatmapsetId } from "../core/setId";
import { statusKey, type JobStatus, type PopupRequest, type Stage } from "../shared/messages";

const LABELS: Record<Stage, string> = {
  fetching: "Fetching…",
  unzipping: "Unzipping…",
  tagging: "Tagging…",
  saving: "Saving…",
  saved: "Saved",
  failed: "Failed",
};

const button = document.getElementById("download") as HTMLButtonElement;
const statusLine = document.getElementById("status") as HTMLParagraphElement;

function render(status: JobStatus | undefined): void {
  statusLine.classList.remove("error");
  if (status === undefined) {
    statusLine.textContent = "";
    button.disabled = false;
    return;
  }

  let text = LABELS[status.stage];
  if (status.detail !== "") {
    text = `${text}: ${status.detail}`;
  }
  statusLine.textContent = text;
  if (status.stage === "failed") {
    statusLine.classList.add("error");
  }
  button.disabled = status.stage !== "saved" && status.stage !== "failed";
}

async function main(): Promise<void> {
  // activeTab grants the URL of the current tab because opening the popup
  // counts as a user gesture, so the broad "tabs" permission is not needed.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const setId = parseBeatmapsetId(tab?.url);
  if (setId === null) {
    document.getElementById("not-beatmap")!.hidden = false;
    return;
  }

  document.getElementById("beatmap")!.hidden = false;
  document.getElementById("set-id")!.textContent = String(setId);

  const key = statusKey(setId);
  const stored = await chrome.storage.session.get(key);
  render(stored[key] as JobStatus | undefined);
  chrome.storage.session.onChanged.addListener((changes) => {
    if (key in changes) {
      render(changes[key].newValue as JobStatus | undefined);
    }
  });

  button.addEventListener("click", () => {
    button.disabled = true;
    const request: PopupRequest = { target: "background", type: "download", setId };
    chrome.runtime.sendMessage(request).catch((error: unknown) => {
      render({ stage: "failed", detail: String(error) });
    });
  });
}

main();
