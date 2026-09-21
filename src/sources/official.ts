import { fetchArchive, NotArchiveError } from "./http";
import { SourceError, type Source } from "./types";

// osu.ppy.sh itself. Only works while the user is logged in, since the session
// cookie is what authorises the download. It is heavily rate limited and sits
// behind Cloudflare, so it is off by default and only ever tried last.
export const official: Source = {
  name: "osu.ppy.sh",
  async fetchOsz(setId, signal) {
    try {
      return await fetchArchive(`https://osu.ppy.sh/beatmapsets/${setId}/download?noVideo=1`, signal, {
        credentials: "include",
      });
    } catch (error) {
      // A logged-out request is redirected back to the beatmap page, and a
      // Cloudflare challenge is also HTML, so both land here.
      if (error instanceof NotArchiveError) {
        throw new SourceError("not logged in to osu.ppy.sh, or blocked by a Cloudflare check");
      }
      throw error;
    }
  },
};
