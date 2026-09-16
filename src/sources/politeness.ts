import { SourceError, type Source } from "./types";

// The mirrors are run by volunteers. These limits are deliberately not
// configurable from the options page.
export const MIN_GAP_MS = 2000;
export const BACKOFF_START_MS = 5000;
export const MAX_RETRIES = 3;

export interface Clock {
  now(): number;
  sleep(ms: number, signal: AbortSignal): Promise<void>;
}

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms, signal) => new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  }),
};

// Runs tasks strictly one at a time with a minimum gap after each finishes.
// The state is in memory only: if the service worker is shut down for being
// idle, far more than the gap has already passed.
export class RateLimiter {
  private tail: Promise<unknown> = Promise.resolve();
  private lastFinished = -Infinity;

  constructor(private readonly clock: Clock = realClock, private readonly gapMs = MIN_GAP_MS) {}

  run<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
    const next = this.tail.catch(() => undefined).then(async () => {
      const wait = this.lastFinished + this.gapMs - this.clock.now();
      if (wait > 0) {
        await this.clock.sleep(wait, signal);
      }
      try {
        return await task();
      } finally {
        this.lastFinished = this.clock.now();
      }
    });
    this.tail = next;
    return next;
  }
}

// Wraps a source so every request goes through the shared limiter, and a 429
// is retried after Retry-After or an exponential backoff instead of hammering
// the next request straight in.
export function politely(source: Source, limiter: RateLimiter, clock: Clock = realClock): Source {
  return {
    name: source.name,
    async fetchOsz(setId, signal) {
      for (let attempt = 0; ; attempt++) {
        try {
          return await limiter.run(() => source.fetchOsz(setId, signal), signal);
        } catch (error) {
          if (!(error instanceof SourceError) || error.status !== 429) {
            throw error;
          }
          if (attempt >= MAX_RETRIES) {
            throw new SourceError(`Still rate limited after ${MAX_RETRIES} retries, try again later`, 429);
          }
          let delay = BACKOFF_START_MS * 2 ** attempt;
          if (error.retryAfterMs !== null) {
            delay = error.retryAfterMs;
          }
          await clock.sleep(delay, signal);
        }
      }
    },
  };
}
