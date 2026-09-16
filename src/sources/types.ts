export interface Source {
  name: string;
  fetchOsz(setId: number, signal: AbortSignal): Promise<ArrayBuffer>;
}

export class SourceError extends Error {
  readonly status: number | null;
  readonly retryAfterMs: number | null;

  constructor(message: string, status: number | null = null, retryAfterMs: number | null = null) {
    super(message);
    this.name = "SourceError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}
