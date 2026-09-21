export interface HistoryEntry {
  filename: string;
  savedAt: number;
}

// One key per set rather than one big object, so recording a download never
// has to read, modify, and rewrite the whole history.
const PREFIX = "history:";

function historyKey(setId: number): string {
  return `${PREFIX}${setId}`;
}

export async function getHistoryEntry(setId: number): Promise<HistoryEntry | undefined> {
  const key = historyKey(setId);
  const stored = await chrome.storage.local.get(key);
  return stored[key] as HistoryEntry | undefined;
}

export async function recordDownload(setId: number, filename: string): Promise<void> {
  const entry: HistoryEntry = { filename, savedAt: Date.now() };
  await chrome.storage.local.set({ [historyKey(setId)]: entry });
}

export async function clearHistory(): Promise<number> {
  const everything = await chrome.storage.local.get(null);
  const keys = Object.keys(everything).filter((key) => key.startsWith(PREFIX));
  await chrome.storage.local.remove(keys);
  return keys.length;
}
