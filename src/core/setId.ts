// Only the URL is relied on, never the page DOM: the site is a single-page app
// with generated class names that change between deploys.
const BEATMAPSET_PATH = /^\/beatmapsets\/(\d+)\/?$/;

export function parseBeatmapsetId(url: string | undefined): number | null {
  if (url === undefined) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "osu.ppy.sh") {
    return null;
  }

  // The difficulty lives in the hash ("#osu/789012"), which URL keeps out of
  // pathname, so the set id is the only number left to match.
  const match = BEATMAPSET_PATH.exec(parsed.pathname);
  if (match === null) {
    return null;
  }
  const id = Number(match[1]);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }
  return id;
}
