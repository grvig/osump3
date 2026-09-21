import { SourceError } from "./types";

// The response arrived but was not a zip, typically an HTML error or login page.
export class NotArchiveError extends SourceError {}

// A set with a long video or a heavy storyboard can run past 100 MB. Anything
// beyond this is not worth holding in memory just to pull out one audio file.
export const MAX_ARCHIVE_BYTES = 150 * 1024 * 1024;

const CLIENT_ID = "osump3/0.1 (+https://github.com/grvig/osump3)";

export function parseRetryAfter(header: string | null, now: number = Date.now()): number | null {
  if (header === null || header.trim() === "") {
    return null;
  }
  const seconds = Number(header);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }
  const date = Date.parse(header);
  if (Number.isNaN(date)) {
    return null;
  }
  return Math.max(0, date - now);
}

export async function fetchArchive(url: string, signal: AbortSignal, init: RequestInit = {}): Promise<ArrayBuffer> {
  const sizeGuard = new AbortController();
  const response = await fetch(url, {
    ...init,
    // Browsers may ignore this header, but where it is honoured it lets mirror
    // operators tell this traffic apart.
    headers: { "User-Agent": CLIENT_ID },
    signal: AbortSignal.any([signal, sizeGuard.signal]),
  });

  if (!response.ok) {
    const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
    throw new SourceError(`HTTP ${response.status} from ${new URL(url).host}`, response.status, retryAfter);
  }

  const declared = Number(response.headers.get("Content-Length"));
  if (declared > MAX_ARCHIVE_BYTES || response.body === null) {
    sizeGuard.abort();
    throw new SourceError("Archive is too large or empty");
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    // Content-Length can be missing or wrong, so the cap is enforced on the
    // bytes actually received as well.
    if (total > MAX_ARCHIVE_BYTES) {
      sizeGuard.abort();
      throw new SourceError("Archive is larger than the 150 MB limit");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  // Mirrors sometimes answer a missing set with a 200 and an HTML page.
  if (total < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    throw new NotArchiveError(`${new URL(url).host} did not return an osz archive`);
  }
  return bytes.buffer;
}
