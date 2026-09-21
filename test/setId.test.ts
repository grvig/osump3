import { describe, expect, it } from "vitest";
import { parseBeatmapsetId } from "../src/core/setId";

describe("parseBeatmapsetId", () => {
  it.each([
    ["https://osu.ppy.sh/beatmapsets/123456", 123456],
    ["https://osu.ppy.sh/beatmapsets/123456#osu/789012", 123456],
    ["https://osu.ppy.sh/beatmapsets/123456/", 123456],
    ["https://osu.ppy.sh/beatmapsets/123456?mode=taiko#taiko/1", 123456],
  ])("reads %s", (url, expected) => {
    expect(parseBeatmapsetId(url)).toBe(expected);
  });

  it.each([
    [undefined],
    [""],
    ["not a url"],
    ["https://osu.ppy.sh/"],
    ["https://osu.ppy.sh/beatmapsets"],
    ["https://osu.ppy.sh/beatmapsets/abc"],
    ["https://osu.ppy.sh/beatmapsets/0"],
    ["https://osu.ppy.sh/beatmapsets/123/discussion"],
    ["https://osu.ppy.sh/users/2"],
    ["http://osu.ppy.sh/beatmapsets/123"],
    ["https://evil.example/beatmapsets/123"],
    ["https://osu.ppy.sh.evil.example/beatmapsets/123"],
    ["https://osu.ppy.sh/beatmapsets/99999999999999999999"],
  ])("rejects %s", (url) => {
    expect(parseBeatmapsetId(url)).toBeNull();
  });
});
