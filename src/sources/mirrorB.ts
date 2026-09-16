import { fetchArchive } from "./http";
import type { Source } from "./types";

// nerinyan.moe. The api host redirects to dl.nerinyan.moe, so both origins are
// listed in the manifest. The background is kept because it becomes the cover.
export const nerinyan: Source = {
  name: "nerinyan.moe",
  fetchOsz(setId, signal) {
    const params = new URLSearchParams({ noVideo: "1", noStoryboard: "1", noHitsound: "1" });
    return fetchArchive(`https://api.nerinyan.moe/d/${setId}?${params}`, signal);
  },
};
