import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";

const outdir = "dist";

// Each entry becomes one standalone script in dist. Everything is bundled
// locally because MV3 refuses to run remotely hosted code.
const entryPoints = {
  offscreen: "src/offscreen/offscreen.ts",
};

// HTML pages and the manifest are copied as-is.
const staticFiles = {
  "manifest.json": "manifest.json",
  "offscreen.html": "src/offscreen/offscreen.html",
};

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

if (Object.keys(entryPoints).length > 0) {
  await build({
    entryPoints,
    outdir,
    bundle: true,
    format: "esm",
    target: "chrome120",
    minify: false,
    sourcemap: "linked",
    logLevel: "info",
  });
}

for (const [dest, src] of Object.entries(staticFiles)) {
  cpSync(src, `${outdir}/${dest}`);
}
