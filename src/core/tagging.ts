import { ID3Writer } from "browser-id3-writer";
import type { Extracted } from "./extract";
import { pickDisplayNames, type NamingScheme } from "./naming";

export type AlbumMode = "source" | "fixed" | "blank";

export interface TagOptions {
  scheme: NamingScheme;
  albumMode: AlbumMode;
  albumText: string;
  embedCover: boolean;
}

// ImageType.CoverFront. The library declares it as a const enum, which cannot
// be imported when each file is compiled on its own.
const COVER_FRONT = 3;

export function beatmapsetUrl(setId: number): string {
  return `https://osu.ppy.sh/beatmapsets/${setId}`;
}

// Writes an ID3v2.3 tag onto mp3 audio. Callers must check audioFormat first:
// writing an ID3 header onto an ogg stream would corrupt it.
export function tagMp3(extracted: Extracted, setId: number, options: TagOptions): ArrayBuffer {
  const meta = extracted.metadata;
  const names = pickDisplayNames(meta, options.scheme);
  const audio = extracted.audio;
  const writer = new ID3Writer(audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength));

  if (names.title !== "") {
    writer.setFrame("TIT2", names.title);
  }
  if (names.artist !== "") {
    writer.setFrame("TPE1", [names.artist]);
  }

  let album = "";
  if (options.albumMode === "source") {
    album = meta.source;
  } else if (options.albumMode === "fixed") {
    album = options.albumText.trim();
  }
  if (album !== "") {
    writer.setFrame("TALB", album);
  }

  // The mapper is not the composer, so it goes in a custom frame rather than TCOM.
  if (meta.creator !== "") {
    writer.setFrame("TXXX", { description: "osu! mapper", value: meta.creator });
  }
  writer.setFrame("COMM", { description: "", text: `osu! beatmapset ${setId}` });
  writer.setFrame("WOAF", beatmapsetUrl(setId));

  if (options.embedCover && extracted.cover !== null) {
    const cover = extracted.cover;
    writer.setFrame("APIC", {
      type: COVER_FRONT,
      description: "Background",
      data: cover.buffer.slice(cover.byteOffset, cover.byteOffset + cover.byteLength),
    });
  }

  return writer.addTag();
}
