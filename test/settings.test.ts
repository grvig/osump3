import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normaliseSettings } from "../src/core/settings";

describe("normaliseSettings", () => {
  it("returns the defaults for missing or junk input", () => {
    expect(normaliseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings("nonsense")).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings({ scheme: "klingon", albumMode: 3, embedCover: "yes" })).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid stored values", () => {
    const settings = normaliseSettings({ scheme: "romanised", albumMode: "fixed", albumText: "Mine", embedCover: false });
    expect(settings.scheme).toBe("romanised");
    expect(settings.albumMode).toBe("fixed");
    expect(settings.albumText).toBe("Mine");
    expect(settings.embedCover).toBe(false);
  });

  it("only enables the official source on an explicit true", () => {
    expect(normaliseSettings({}).officialEnabled).toBe(false);
    expect(normaliseSettings({ officialEnabled: "true" }).officialEnabled).toBe(false);
    expect(normaliseSettings({ officialEnabled: true }).officialEnabled).toBe(true);
  });

  it("keeps the stored mirror order and enabled flags", () => {
    const settings = normaliseSettings({ mirrors: [{ id: "nerinyan", enabled: true }, { id: "catboy", enabled: false }] });
    expect(settings.mirrors).toEqual([{ id: "nerinyan", enabled: true }, { id: "catboy", enabled: false }]);
  });

  it("drops unknown and duplicate mirrors and appends missing ones", () => {
    const settings = normaliseSettings({ mirrors: [{ id: "gone" }, { id: "nerinyan" }, { id: "nerinyan", enabled: false }, null] });
    expect(settings.mirrors).toEqual([{ id: "nerinyan", enabled: true }, { id: "catboy", enabled: true }]);
  });
});
