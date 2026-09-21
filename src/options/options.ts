import type { NamingScheme } from "../core/naming";
import type { MirrorId, Settings } from "../core/settings";
import type { AlbumMode } from "../core/tagging";
import { clearHistory } from "../shared/history";
import { loadSettings, saveSettings } from "../shared/settingsStore";

const MIRROR_NAMES: Record<MirrorId, string> = {
  catboy: "catboy.best (Mino)",
  nerinyan: "nerinyan.moe",
};

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const scheme = byId<HTMLSelectElement>("scheme");
const albumMode = byId<HTMLSelectElement>("albumMode");
const albumText = byId<HTMLInputElement>("albumText");
const embedCover = byId<HTMLInputElement>("embedCover");
const officialEnabled = byId<HTMLInputElement>("officialEnabled");
let settings: Settings;

async function persist(): Promise<void> {
  settings.scheme = scheme.value as NamingScheme;
  settings.albumMode = albumMode.value as AlbumMode;
  settings.albumText = albumText.value;
  settings.embedCover = embedCover.checked;
  settings.officialEnabled = officialEnabled.checked;
  await saveSettings(settings);
  byId("albumTextRow").hidden = settings.albumMode !== "fixed";
  byId("saved").textContent = "Saved";
}

function renderMirrors(): void {
  const list = byId("mirrors");
  list.replaceChildren();
  settings.mirrors.forEach((mirror, index) => {
    const row = document.createElement("div");
    row.className = "mirror";

    const enabled = document.createElement("input");
    enabled.type = "checkbox";
    enabled.checked = mirror.enabled;
    enabled.addEventListener("change", () => {
      mirror.enabled = enabled.checked;
      persist();
    });

    const name = document.createElement("span");
    name.textContent = MIRROR_NAMES[mirror.id];
    row.append(enabled, name, moveButton("↑", index, -1), moveButton("↓", index, 1));
    list.append(row);
  });
}

function moveButton(label: string, index: number, offset: number): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  const target = index + offset;
  button.disabled = target < 0 || target >= settings.mirrors.length;
  button.addEventListener("click", () => {
    const [moved] = settings.mirrors.splice(index, 1);
    settings.mirrors.splice(target, 0, moved);
    renderMirrors();
    persist();
  });
  return button;
}

async function main(): Promise<void> {
  settings = await loadSettings();
  scheme.value = settings.scheme;
  albumMode.value = settings.albumMode;
  albumText.value = settings.albumText;
  embedCover.checked = settings.embedCover;
  officialEnabled.checked = settings.officialEnabled;
  byId("albumTextRow").hidden = settings.albumMode !== "fixed";
  renderMirrors();

  for (const input of [scheme, albumMode, albumText, embedCover, officialEnabled]) {
    input.addEventListener("change", () => persist());
  }
  byId("clearHistory").addEventListener("click", async () => {
    const removed = await clearHistory();
    byId("historyResult").textContent = `Removed ${removed} entries.`;
  });
}

main();
