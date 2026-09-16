import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseOsu } from "../src/core/osuParser";

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

describe("parseOsu", () => {
  it("reads metadata and the background from a normal map", () => {
    expect(parseOsu(fixture("normal.osu"))).toEqual({
      audioFilename: "audio.mp3",
      title: "Sayonara no Yukue",
      titleUnicode: "さよならのゆくえ",
      artist: "Aimer",
      artistUnicode: "エメ",
      creator: "SomeMapper",
      source: "Some Anime",
      tags: "ballad piano",
      beatmapSetId: 123456,
      background: "bg.jpg",
    });
  });

  it("handles a BOM and CRLF line endings", () => {
    const text = "﻿osu file format v14\r\n\r\n[General]\r\nAudioFilename: song.mp3\r\n\r\n"
      + "[Metadata]\r\nTitle:Bom Title\r\nBeatmapSetID:42\r\n\r\n[Events]\r\n0,0,\"back.png\",0,0\r\n";
    const meta = parseOsu(text);
    expect(meta.audioFilename).toBe("song.mp3");
    expect(meta.title).toBe("Bom Title");
    expect(meta.beatmapSetId).toBe(42);
    expect(meta.background).toBe("back.png");
  });

  it("ignores video and storyboard events when looking for a background", () => {
    const meta = parseOsu(fixture("video-only.osu"));
    expect(meta.background).toBeNull();
    expect(meta.audioFilename).toBe("track.mp3");
  });

  it("treats a negative set id as unknown and a missing Source as empty", () => {
    const meta = parseOsu(fixture("video-only.osu"));
    expect(meta.beatmapSetId).toBeNull();
    expect(meta.source).toBe("");
    expect(meta.titleUnicode).toBe("");
  });

  it("tolerates odd spacing, comments, unknown sections, and unquoted names", () => {
    const meta = parseOsu(fixture("odd-spacing.osu"));
    expect(meta.audioFilename).toBe("Audio.MP3");
    expect(meta.title).toBe("Spaced Out");
    expect(meta.artist).toBe("Loose Artist");
    expect(meta.creator).toBe("Mapper: With Colon");
    expect(meta.tags).toBe("");
    expect(meta.background).toBe("unquoted.jpg");
  });

  it("returns empty fields instead of throwing on garbage input", () => {
    const meta = parseOsu("not an osu file\n[Events]\n,,,\n");
    expect(meta.audioFilename).toBe("");
    expect(meta.background).toBeNull();
    expect(meta.beatmapSetId).toBeNull();
  });
});
