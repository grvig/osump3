import type { NamingScheme } from "./naming";
import type { AlbumMode, TagOptions } from "./tagging";

export type MirrorId = "catboy" | "nerinyan";
export const MIRROR_IDS: readonly MirrorId[] = ["catboy", "nerinyan"];

export interface MirrorSetting {
  id: MirrorId;
  enabled: boolean;
}

export interface Settings {
  mirrors: MirrorSetting[];
  scheme: NamingScheme;
  albumMode: AlbumMode;
  albumText: string;
  embedCover: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  mirrors: MIRROR_IDS.map((id) => ({ id, enabled: true })),
  scheme: "unicode",
  albumMode: "source",
  albumText: "osu!",
  embedCover: true,
};

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (allowed.includes(value as T)) {
    return value as T;
  }
  return fallback;
}

// Stored settings may come from an older version or be hand-edited through
// sync storage, so every field is checked rather than trusted. Unknown mirrors
// are dropped and newly added ones are appended, enabled, at the end.
export function normaliseSettings(raw: unknown): Settings {
  const stored = (raw ?? {}) as Partial<Record<keyof Settings, unknown>>;

  const mirrors: MirrorSetting[] = [];
  if (Array.isArray(stored.mirrors)) {
    for (const entry of stored.mirrors) {
      const id = pick(entry?.id, MIRROR_IDS, null);
      if (id !== null && !mirrors.some((mirror) => mirror.id === id)) {
        mirrors.push({ id, enabled: entry.enabled !== false });
      }
    }
  }
  for (const id of MIRROR_IDS) {
    if (!mirrors.some((mirror) => mirror.id === id)) {
      mirrors.push({ id, enabled: true });
    }
  }

  let albumText = DEFAULT_SETTINGS.albumText;
  if (typeof stored.albumText === "string") {
    albumText = stored.albumText;
  }
  let embedCover = DEFAULT_SETTINGS.embedCover;
  if (typeof stored.embedCover === "boolean") {
    embedCover = stored.embedCover;
  }

  return {
    mirrors,
    scheme: pick(stored.scheme, ["unicode", "romanised"], DEFAULT_SETTINGS.scheme),
    albumMode: pick(stored.albumMode, ["source", "fixed", "blank"], DEFAULT_SETTINGS.albumMode),
    albumText,
    embedCover,
  };
}

export function tagOptionsFrom(settings: Settings): TagOptions {
  return {
    scheme: settings.scheme,
    albumMode: settings.albumMode,
    albumText: settings.albumText,
    embedCover: settings.embedCover,
  };
}
