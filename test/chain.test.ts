import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFromChain } from "../src/sources/chain";
import { MAX_ARCHIVE_BYTES, parseRetryAfter } from "../src/sources/http";
import { catboy } from "../src/sources/mirrorA";
import { nerinyan } from "../src/sources/mirrorB";
import { official } from "../src/sources/official";

const ZIP_BYTES = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);

function mockFetch(...responses: Array<() => Response>) {
  const fn = vi.fn();
  for (const make of responses) {
    fn.mockImplementationOnce(async () => make());
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchFromChain", () => {
  it("falls back to the second source when the first returns 500", async () => {
    const fetchMock = mockFetch(
      () => new Response("oops", { status: 500 }),
      () => new Response(ZIP_BYTES),
    );
    const result = await fetchFromChain([catboy, nerinyan], 123, new AbortController().signal);

    expect(result.sourceName).toBe("nerinyan.moe");
    expect(new Uint8Array(result.data)).toEqual(ZIP_BYTES);
    expect(fetchMock.mock.calls[0][0]).toBe("https://catboy.best/d/123n");
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.nerinyan.moe/d/123?noVideo=1&noStoryboard=1&noHitsound=1",
    );
  });

  it("reports every failure when all sources fail", async () => {
    mockFetch(
      () => new Response("gone", { status: 404 }),
      () => new Response("<html>not found</html>", { status: 200 }),
    );
    const attempt = fetchFromChain([catboy, nerinyan], 7, new AbortController().signal);

    await expect(attempt).rejects.toThrow(/catboy\.best: HTTP 404/);
    await expect(attempt).rejects.toThrow(/nerinyan\.moe: .*did not return an osz archive/);
  });

  it("rejects an archive whose declared size is over the cap", async () => {
    mockFetch(
      () => new Response(ZIP_BYTES, { headers: { "Content-Length": String(MAX_ARCHIVE_BYTES + 1) } }),
    );
    await expect(fetchFromChain([catboy], 1, new AbortController().signal)).rejects.toThrow(/too large/);
  });

  it("stops the chain instead of falling back when the user aborts", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => {
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchFromChain([catboy, nerinyan], 1, controller.signal)).rejects.toThrow(/Aborted/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("explains a logged-out response from the official source", async () => {
    const fetchMock = mockFetch(() => new Response("<html>beatmap page</html>", { status: 200 }));
    await expect(fetchFromChain([official], 5, new AbortController().signal)).rejects.toThrow(/not logged in/);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include" });
  });

  it("fails clearly with no sources", async () => {
    await expect(fetchFromChain([], 1, new AbortController().signal)).rejects.toThrow(/No download sources/);
  });
});

describe("parseRetryAfter", () => {
  it("reads seconds and HTTP dates", () => {
    expect(parseRetryAfter("12")).toBe(12000);
    expect(parseRetryAfter("Wed, 16 Sep 2026 10:00:30 GMT", Date.parse("Wed, 16 Sep 2026 10:00:00 GMT"))).toBe(30000);
  });

  it("returns null for missing or junk values", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
  });
});
