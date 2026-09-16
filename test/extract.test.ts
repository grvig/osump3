import { strToU8, zipSync, type Zippable } from "fflate";
import { describe, expect, it } from "vitest";
import { extractOsz, sniffAudio, sniffImage } from "../src/core/extract";

const MP3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]);
const OTHER_MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);
const OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 2]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

function osu(audio: string, title: string, background?: string): Uint8Array {
  let events = "";
  if (background !== undefined) {
    events = `0,0,"${background}",0,0`;
  }
  return strToU8(
    `osu file format v14\n\n[General]\nAudioFilename: ${audio}\n\n`
    + `[Metadata]\nTitle:${title}\nArtist:Tester\nBeatmapSetID:1\n\n[Events]\n${events}\n`,
  );
}

function osz(files: Zippable): ArrayBuffer {
  const bytes = zipSync(files);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe("extractOsz", () => {
  it("matches references to zip entries regardless of case and separators", () => {
    const result = extractOsz(osz({
      "Tester - Song (Mapper) [Hard].osu": osu("Audio.MP3", "Song", "BG\\Cover.JPG"),
      "audio.mp3": MP3,
      "bg/cover.jpg": PNG,
    }));

    expect(result.audio).toEqual(MP3);
    expect(result.audioFormat).toBe("mp3");
    expect(result.audioExtension).toBe("mp3");
    expect(result.cover).toEqual(PNG);
    // The file is named .jpg but the bytes are a PNG.
    expect(result.coverMime).toBe("image/png");
    expect(result.metadata.title).toBe("Song");
  });

  it("picks the audio used by the most difficulties", () => {
    const result = extractOsz(osz({
      "a.osu": osu("intro.mp3", "Intro"),
      "b.osu": osu("full.mp3", "Full", "bg.jpg"),
      "c.osu": osu("full.mp3", "Full"),
      "intro.mp3": MP3,
      "full.mp3": OTHER_MP3,
      "bg.jpg": JPEG,
    }));

    expect(result.audio).toEqual(OTHER_MP3);
    expect(result.metadata.title).toBe("Full");
    expect(result.coverMime).toBe("image/jpeg");
  });

  it("breaks ties on the first difficulty encountered", () => {
    const result = extractOsz(osz({
      "a.osu": osu("first.mp3", "First"),
      "b.osu": osu("second.mp3", "Second"),
      "first.mp3": MP3,
      "second.mp3": OTHER_MP3,
    }));
    expect(result.metadata.title).toBe("First");
  });

  it("returns no cover when the background is missing or not an image", () => {
    const missing = extractOsz(osz({ "a.osu": osu("a.mp3", "A", "gone.jpg"), "a.mp3": MP3 }));
    expect(missing.cover).toBeNull();

    const junk = extractOsz(osz({ "a.osu": osu("a.mp3", "A", "bg.jpg"), "a.mp3": MP3, "bg.jpg": strToU8("nope") }));
    expect(junk.cover).toBeNull();
    expect(junk.coverMime).toBeNull();
  });

  it("detects ogg audio even when the extension says otherwise", () => {
    const result = extractOsz(osz({ "a.osu": osu("song.mp3", "A"), "song.mp3": OGG }));
    expect(result.audioFormat).toBe("ogg");
    expect(result.audioExtension).toBe("ogg");
  });

  it("keeps the original extension for unrecognised audio", () => {
    const result = extractOsz(osz({ "a.osu": osu("song.wav", "A"), "song.wav": strToU8("RIFF....WAVE") }));
    expect(result.audioFormat).toBe("other");
    expect(result.audioExtension).toBe("wav");
  });

  it("throws a readable error when the audio file is absent", () => {
    expect(() => extractOsz(osz({ "a.osu": osu("song.mp3", "A") }))).toThrow(/song\.mp3/);
    expect(() => extractOsz(osz({ "readme.txt": strToU8("hi") }))).toThrow(/audio file/);
  });
});

describe("sniffers", () => {
  it("recognise their formats and reject empty input", () => {
    expect(sniffAudio(OTHER_MP3)).toBe("mp3");
    expect(sniffAudio(new Uint8Array())).toBe("other");
    expect(sniffImage(JPEG)).toBe("image/jpeg");
    expect(sniffImage(new Uint8Array())).toBeNull();
  });
});
