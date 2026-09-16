import { describe, expect, it, vi } from "vitest";
import { politely, RateLimiter, type Clock } from "../src/sources/politeness";
import { SourceError, type Source } from "../src/sources/types";

function fakeClock() {
  const sleeps: number[] = [];
  let now = 0;
  const clock: Clock = {
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
  };
  return { clock, sleeps };
}

function scriptedSource(...outcomes: Array<ArrayBuffer | Error>): Source {
  const fetchOsz = vi.fn();
  for (const outcome of outcomes) {
    if (outcome instanceof Error) {
      fetchOsz.mockRejectedValueOnce(outcome);
    } else {
      fetchOsz.mockResolvedValueOnce(outcome);
    }
  }
  return { name: "test", fetchOsz };
}

const signal = new AbortController().signal;
const ARCHIVE = new ArrayBuffer(4);

describe("RateLimiter", () => {
  it("waits the minimum gap between back-to-back requests", async () => {
    const { clock, sleeps } = fakeClock();
    const limiter = new RateLimiter(clock);
    await limiter.run(async () => 1, signal);
    await limiter.run(async () => 2, signal);
    expect(sleeps).toEqual([2000]);
  });

  it("never runs two tasks at once", async () => {
    const limiter = new RateLimiter(fakeClock().clock);
    let active = 0;
    let peak = 0;
    const task = async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
    };
    await Promise.all([limiter.run(task, signal), limiter.run(task, signal), limiter.run(task, signal)]);
    expect(peak).toBe(1);
  });
});

describe("politely", () => {
  it("honours Retry-After on a 429 and then succeeds", async () => {
    const { clock, sleeps } = fakeClock();
    const source = politely(scriptedSource(new SourceError("slow down", 429, 7000), ARCHIVE), new RateLimiter(clock), clock);
    await expect(source.fetchOsz(1, signal)).resolves.toBe(ARCHIVE);
    expect(sleeps).toContain(7000);
  });

  it("backs off exponentially and gives up after three retries", async () => {
    const { clock, sleeps } = fakeClock();
    const limited = () => new SourceError("slow down", 429);
    const inner = scriptedSource(limited(), limited(), limited(), limited());
    const source = politely(inner, new RateLimiter(clock, 0), clock);

    await expect(source.fetchOsz(1, signal)).rejects.toThrow(/rate limited after 3 retries/);
    expect(sleeps).toEqual([5000, 10000, 20000]);
    expect(inner.fetchOsz).toHaveBeenCalledTimes(4);
  });

  it("does not retry other errors", async () => {
    const { clock } = fakeClock();
    const inner = scriptedSource(new SourceError("boom", 500));
    await expect(politely(inner, new RateLimiter(clock), clock).fetchOsz(1, signal)).rejects.toThrow("boom");
    expect(inner.fetchOsz).toHaveBeenCalledTimes(1);
  });
});
