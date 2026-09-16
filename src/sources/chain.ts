import { SourceError, type Source } from "./types";

export interface ChainResult {
  data: ArrayBuffer;
  sourceName: string;
}

// Tries each source in order and returns the first archive that arrives.
// Mirrors come and go, so one failing is expected and not worth surfacing
// unless every source fails.
export async function fetchFromChain(sources: Source[], setId: number, signal: AbortSignal): Promise<ChainResult> {
  if (sources.length === 0) {
    throw new SourceError("No download sources are enabled");
  }

  const failures: string[] = [];
  for (const source of sources) {
    // A user cancel should stop the whole chain, not move on to the next mirror.
    signal.throwIfAborted();
    try {
      const data = await source.fetchOsz(setId, signal);
      return { data, sourceName: source.name };
    } catch (error) {
      if (signal.aborted) {
        throw error;
      }
      failures.push(`${source.name}: ${describeError(error)}`);
    }
  }
  throw new SourceError(`Every source failed. ${failures.join("; ")}`);
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
