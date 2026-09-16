import { describe, expect, it } from "vitest";
import type { Extracted } from "../src/core/extract";
import { parseOsu } from "../src/core/osuParser";
import { tagMp3, type TagOptions } from "../src/core/tagging";

const AUDIO = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 1, 2, 3, 4]);
const COVER = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9]);

function extracted(): Extracted {
  const metadata = parseOsu("[Metadata]\nTitle:Title\nArtist:Artist\nCreator:Mapper\nSource:Show\n");
  return { metadata, audio: AUDIO, audioFormat: "mp3", audioExtension: "mp3", cover: COVER, coverMime: "image/jpeg" };
}

function tagText(tagged: ArrayBuffer): string {
  return Buffer.from(tagged).toString("latin1");
}

const defaults: TagOptions = { scheme: "unicode", albumMode: "source", albumText: "", embedCover: true };

describe("tagMp3", () => {
  it("writes an ID3 header ahead of the untouched audio", () => {
    const bytes = new Uint8Array(tagMp3(extracted(), 42, defaults));
    expect(Buffer.from(bytes.slice(0, 3)).toString()).toBe("ID3");
    expect(bytes.slice(-AUDIO.length)).toEqual(AUDIO);
  });

  it("includes the expected frames", () => {
    const raw = tagText(tagMp3(extracted(), 42, defaults));
    for (const id of ["TIT2", "TPE1", "TALB", "TXXX", "COMM", "WOAF", "APIC"]) {
      expect(raw).toContain(id);
    }
    expect(raw).toContain("https://osu.ppy.sh/beatmapsets/42");
  });

  it("leaves out the album and cover when disabled", () => {
    const raw = tagText(tagMp3(extracted(), 42, { ...defaults, albumMode: "blank", embedCover: false }));
    expect(raw).not.toContain("TALB");
    expect(raw).not.toContain("APIC");
  });
});
