import { normaliseSettings, type Settings } from "../core/settings";

// Sync storage so the choices follow the user between their own browsers.
const KEY = "settings";

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.sync.get(KEY);
  return normaliseSettings(stored[KEY]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [KEY]: settings });
}
