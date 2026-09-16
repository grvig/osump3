import { fetchArchive } from "./http";
import type { Source } from "./types";

// catboy.best (Mino). The "n" suffix on the set id serves the archive without
// its video, which is the bulk of most large sets. Mino has no switch for
// storyboards or hitsounds, and the background is kept, which is what we want.
export const catboy: Source = {
  name: "catboy.best",
  fetchOsz(setId, signal) {
    return fetchArchive(`https://catboy.best/d/${setId}n`, signal);
  },
};
