# Documentation images

The images in `images/` capture the real Localtone renderer in Electron at 100% app zoom. The collection is fictional: all artist/album/track names, geometric covers and synthesized sound were created for the screenshots. No user library, commercial cover art or service credentials are used.

`demo-art/` contains original project artwork, under the same GPL-3.0-or-later terms as other original assets. `capture-presentation.cjs` creates disposable audio/data in an isolated temporary folder, launches the existing app, and captures Covers, Albums and Appearance. It does not change application defaults or any user profile. Do not point it at a personal collection.

To refresh on a native Windows desktop after `npm ci`:

```sh
npx electron docs/capture-presentation.cjs
```

The **Capture documentation screenshots** GitHub Actions workflow runs the same process and uploads its results for visual review. Capture tools are developer utilities; the screenshots do not imply every depicted name is an included music release. The README uses lossless WebP versions of the full captures and a reduced-size GIF sequence of actual X/X/P keyboard input. Keep the original PNGs in the workflow artifact; regenerate the WebP files without changing pixels. Inspect captures before committing them, and remove transient errors or menus by correcting the demo setup rather than painting over the interface.
