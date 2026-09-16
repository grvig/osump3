import { strFromU8, unzipSync } from "fflate";
import { parseOsu, type OsuMetadata } from "./osuParser";

export type AudioFormat = "mp3" | "ogg" | "other";
export type CoverMime = "image/jpeg" | "image/png";

export interface Extracted {
  metadata: OsuMetadata;
  audio: Uint8Array;
  audioFormat: AudioFormat;
  audioExtension: string;
  cover: Uint8Array | null;
  coverMime: CoverMime | null;
}

// Maps reference files with whatever case and separators the mapper typed,
// which often differ from the actual zip entry ("Audio.MP3" vs "audio.mp3"),
// so every lookup goes through this key.
function entryKey(name: string): string {
  return name.replace(/\\/g, "/").replace(/^(\.\/)+/, "").toLowerCase();
}

export function sniffAudio(bytes: Uint8Array): AudioFormat {
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return "mp3";
  }
  // A bare MPEG frame sync: eleven set bits.
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return "mp3";
  }
  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return "ogg";
  }
  return "other";
}

// Beatmaps regularly ship PNGs named .jpg and the reverse, so the extension
// is never trusted.
export function sniffImage(bytes: Uint8Array): CoverMime | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  return null;
}

export function extractOsz(buffer: ArrayBuffer): Extracted {
  const zip = new Uint8Array(buffer);
  // First pass only inflates the .osu files; a video can be most of the archive.
  const osuFiles = unzipSync(zip, { filter: (file) => file.name.toLowerCase().endsWith(".osu") });

  // A set can mix audio files across difficulties. The one most difficulties
  // use is the song; ties go to whichever was seen first.
  const byAudio = new Map<string, OsuMetadata[]>();
  for (const data of Object.values(osuFiles)) {
    const meta = parseOsu(strFromU8(data));
    const key = entryKey(meta.audioFilename);
    if (key === "") {
      continue;
    }
    const group = byAudio.get(key) ?? [];
    group.push(meta);
    byAudio.set(key, group);
  }

  let audioKey = "";
  let difficulties: OsuMetadata[] = [];
  for (const [key, group] of byAudio) {
    if (group.length > difficulties.length) {
      audioKey = key;
      difficulties = group;
    }
  }
  if (audioKey === "") {
    throw new Error("No difficulty in this archive names an audio file");
  }

  const backgroundKeys = difficulties.map((meta) => entryKey(meta.background ?? "")).filter((key) => key !== "");
  const wanted = new Set([audioKey, ...backgroundKeys]);
  const files = new Map<string, Uint8Array>();
  const inflated = unzipSync(zip, { filter: (file) => wanted.has(entryKey(file.name)) });
  for (const [name, data] of Object.entries(inflated)) {
    files.set(entryKey(name), data);
  }

  const audio = files.get(audioKey);
  if (audio === undefined) {
    throw new Error(`The archive does not contain its audio file "${difficulties[0].audioFilename}"`);
  }

  // A missing or unreadable background is common and only costs the cover.
  let cover: Uint8Array | null = null;
  let coverMime: CoverMime | null = null;
  for (const key of backgroundKeys) {
    const bytes = files.get(key);
    if (bytes !== undefined && sniffImage(bytes) !== null) {
      cover = bytes;
      coverMime = sniffImage(bytes);
      break;
    }
  }

  const audioFormat = sniffAudio(audio);
  let audioExtension: string = audioFormat;
  if (audioFormat === "other") {
    const dot = audioKey.lastIndexOf(".");
    audioExtension = "bin";
    if (dot >= 0 && dot < audioKey.length - 1) {
      audioExtension = audioKey.slice(dot + 1);
    }
  }

  return { metadata: difficulties[0], audio, audioFormat, audioExtension, cover, coverMime };
}
