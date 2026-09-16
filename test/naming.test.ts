import { describe, expect, it } from "vitest";
import { buildFilename, pickDisplayNames, sanitiseStem } from "../src/core/naming";
import { parseOsu } from "../src/core/osuParser";

describe("sanitiseStem", () => {
  it.each([
    ["plain", "Artist - Title", "Artist - Title"],
    ["illegal characters become spaces", 'a<b>c:d"e/f\\g|h?i*j', "a b c d e f g h i j"],
    ["control characters are dropped", "tab	bellend", "tabbellend"],
    ["whitespace collapses", "  lots    of \n space  ", "lots of space"],
    ["edge dots are trimmed", "...hidden.", "hidden"],
    ["unicode survives", "さよならのゆくえ", "さよならのゆくえ"],
    ["reserved name is suffixed", "CON", "CON_"],
    ["reserved name is case-insensitive", "com1", "com1_"],
    ["reserved name only matches the whole stem", "Console", "Console"],
  ])("%s", (_label, input, expected) => {
    expect(sanitiseStem(input, 1)).toBe(expected);
  });

  it("falls back to the set id when nothing is left", () => {
    expect(sanitiseStem("", 99)).toBe("osu-99");
    expect(sanitiseStem('<>:"/\\|?*', 99)).toBe("osu-99");
    expect(sanitiseStem(" . . ", 99)).toBe("osu-99");
  });

  it("truncates long stems to 120 characters without a trailing space", () => {
    const result = sanitiseStem("word ".repeat(60), 1);
    expect(Array.from(result).length).toBeLessThanOrEqual(120);
    expect(result.endsWith(" ")).toBe(false);
  });

  it("truncates by code point so emoji are not split", () => {
    const result = sanitiseStem("😀".repeat(300), 1);
    expect(Array.from(result)).toHaveLength(120);
    expect(result).toBe("😀".repeat(120));
  });
});

describe("pickDisplayNames", () => {
  const meta = parseOsu("[Metadata]\nTitle:Romaji\nTitleUnicode:漢字\nArtist:Band\nArtistUnicode:\n");

  it("prefers unicode and falls back to romanised when blank", () => {
    expect(pickDisplayNames(meta, "unicode")).toEqual({ artist: "Band", title: "漢字" });
  });

  it("uses romanised fields when asked", () => {
    expect(pickDisplayNames(meta, "romanised")).toEqual({ artist: "Band", title: "Romaji" });
  });
});

describe("buildFilename", () => {
  it("joins artist and title and keeps the extension", () => {
    expect(buildFilename({ artist: "AC/DC", title: "T.N.T." }, 5, "mp3")).toBe("AC DC - T.N.T.mp3");
  });

  it("omits the separator when one side is missing", () => {
    expect(buildFilename({ artist: "", title: "Solo" }, 5, "ogg")).toBe("Solo.ogg");
  });

  it("uses the set id when both sides are empty", () => {
    expect(buildFilename({ artist: " ", title: "" }, 5, "mp3")).toBe("osu-5.mp3");
  });

  it("keeps the extension when the stem is truncated", () => {
    const name = buildFilename({ artist: "A", title: "x".repeat(300) }, 5, "mp3");
    expect(name.endsWith(".mp3")).toBe(true);
    expect(name.length).toBe(124);
  });
});
