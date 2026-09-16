export interface OsuMetadata {
  audioFilename: string;
  title: string;
  titleUnicode: string;
  artist: string;
  artistUnicode: string;
  creator: string;
  source: string;
  tags: string;
  beatmapSetId: number | null;
  background: string | null;
}

// Matches a background event. The filename is normally quoted, but very old
// maps sometimes leave the quotes off.
const BACKGROUND_EVENT = /^(?:0|Background)\s*,[^,]*,\s*(?:"([^"]*)"|([^,]*))/;

export function parseOsu(text: string): OsuMetadata {
  const fields = new Map<string, string>();
  let background: string | null = null;
  let section = "";

  // Some editors save the file with a UTF-8 BOM, which would otherwise end up
  // glued to the "osu file format" header.
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("//")) {
      continue;
    }
    if (line.startsWith("[") && line.endsWith("]")) {
      section = line.slice(1, -1);
      continue;
    }

    if (section === "General" || section === "Metadata") {
      // [General] writes "Key: value" while [Metadata] writes "Key:value", so
      // split on the first colon only and trim both halves regardless.
      const colon = line.indexOf(":");
      if (colon > 0) {
        fields.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
      }
    } else if (section === "Events" && background === null) {
      // Events also holds videos ("1," or "Video,") and storyboard sprites, so
      // only the background event types are accepted here.
      const match = BACKGROUND_EVENT.exec(line);
      if (match) {
        const name = (match[1] ?? match[2]).trim();
        if (name !== "") {
          background = name;
        }
      }
    }
  }

  let beatmapSetId: number | null = null;
  const rawId = Number.parseInt(fields.get("BeatmapSetID") ?? "", 10);
  if (Number.isFinite(rawId) && rawId > 0) {
    beatmapSetId = rawId;
  }

  return {
    audioFilename: fields.get("AudioFilename") ?? "",
    title: fields.get("Title") ?? "",
    titleUnicode: fields.get("TitleUnicode") ?? "",
    artist: fields.get("Artist") ?? "",
    artistUnicode: fields.get("ArtistUnicode") ?? "",
    creator: fields.get("Creator") ?? "",
    source: fields.get("Source") ?? "",
    tags: fields.get("Tags") ?? "",
    beatmapSetId,
    background,
  };
}
