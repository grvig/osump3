# osu! MP3 Downloader

A browser extension for Chromium browsers (Brave, Chrome, Edge) that saves the song from an osu! beatmapset as a tagged mp3.

Open a beatmap page on `osu.ppy.sh`, click the extension icon, and press **Download MP3**. The extension fetches the beatmapset archive, pulls out the audio, tags it with the artist, title, and the beatmap background as cover art, and saves it to your Downloads folder as `Artist - Title.mp3`.

Some older maps use `.ogg` audio. Those are saved as `.ogg` without tags, because re-encoding them would mean shipping a very large audio encoder with the extension.

## Disclaimer

- This project is not affiliated with or endorsed by ppy Pty Ltd or osu!.
- It copies audio to your own device for your personal use. It does not host, distribute, or share any files.
- The music in beatmaps is copyrighted by third parties. You are responsible for how you use the files you download.
- The extension rate-limits itself out of respect for the community mirrors it downloads from, which are run by volunteers. Please do not try to get around those limits.

## Install

Publishing this to the Chrome Web Store is unlikely to work: store review is hostile to extensions whose purpose is extracting media, and it could be rejected or removed later. The supported way to install it is loading it unpacked.

1. Download the zip from the latest [GitHub release](https://github.com/grvig/osump3/releases) and extract it, or build it yourself (see below).
2. Open `brave://extensions` (or `chrome://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and pick the extracted folder, the one containing `manifest.json`.

## Options

Right-click the toolbar icon and choose **Options**, or use the link in the popup.

- **Mirrors**: which mirrors to use and in what order. The next mirror is only tried if the one before it fails.
- **Artist and title**: original script (Japanese, etc.) with a romanised fallback, or romanised only. This affects both the tags and the filename.
- **Album**: the beatmap's `Source` field (usually the anime or game), a fixed text, or blank.
- **Cover art**: embed the beatmap background or not.
- **osu.ppy.sh fallback**: off by default. It needs you to be logged in, is heavily rate limited, and heavy use can get your account temporarily restricted. Brave's shields may also block the login cookie for it.
- **History**: the extension remembers what you have downloaded and warns before fetching the same set again. You can clear it here.

## How it works

- The service worker downloads the `.osz` from a mirror, asking for it without video, storyboard, or hitsounds where the mirror supports that. The background image is kept for the cover.
- The archive is handed to an offscreen document, which unzips it, reads the `.osu` files, picks the audio used by most difficulties, writes the ID3 tag, and creates a blob URL. Service workers can't create blob URLs themselves.
- The service worker saves that URL with the downloads API and revokes it once the download finishes or fails.
- Requests go out one at a time with at least two seconds between them. An HTTP 429 is retried after `Retry-After`, or after 5, 10, and 20 seconds, and then it gives up. Archives over 150 MB are aborted.

## Building

Requires Node.js 20 or newer.

```bash
npm install
npm test
npm run build
```

The unpacked extension ends up in `dist/`.

## Manual test checklist

Run through this before each release, using a fresh `npm run build` loaded unpacked:

1. Load `dist/` unpacked and check that the extension page shows no errors.
2. Open a normal map and download it. The mp3 plays and shows the title, artist, and cover in a music player.
3. Open a map that has a video. The download is still small and quick.
4. Open a map with `.ogg` audio. An `.ogg` file is saved with a sensible name.
5. Open a map with Japanese metadata. Check the filename under both naming options.
6. Open a non-beatmap page, such as a user profile. The popup asks you to open a beatmap page.
7. Download the same map again. The popup warns that it is already saved.
8. Untick every mirror in the options and try a download. The error says no sources are enabled.
9. Start several downloads quickly on different maps. Each one waits its turn and none of them fail.

## Prior art

[kabiiQ/BeatmapExporter](https://github.com/kabiiQ/BeatmapExporter) does the same job for a local osu!lazer install on the desktop, and it was a useful reference for how beatmap metadata maps onto ID3 tags. No code is shared between the two projects.

## License

MIT, see [LICENSE](LICENSE).
