# Localtone 0.132.0

A performance and polish update for large libraries and the Windows mini player.

- Large libraries browse much faster. At 50,000 tracks the Albums view now opens, switches collections and searches in well under a second (previously 15–20 seconds), and the Covers view loads artwork only as it scrolls into view. Folder sorting, sidebar totals and starting a track no longer rescan the whole collection.
- Ratings and settings save almost instantly: they are written to a small separate file instead of rewriting the entire collection. Older versions still read collection.json, which is brought up to date by the next library or playlist change.
- First-time library scans read several files at once, with identical results. Very large folders can no longer stop a scan with a stack overflow.
- Windows: the mini player is now its own ready-drawn window. Pressing M switches instantly, without resizing or redrawing the main window, so there is no flash and no layout shift. An open or extended play queue stays exactly as it was. Moving the mini player moves the full window with it when you switch back.
- Visual consistency: first-launch buttons, the sort menu and toolbar buttons share the main window's text size and corners; dialog labels and primary buttons are consistent; empty artist-pane messages line up with artist names. Unused stylesheet rules were removed without changing the rendered result.

## Updating

Quit Localtone before updating. Extract the complete desktop ZIP into a writable folder and keep your existing Localtone-data folder beside Localtone.exe or Localtone.app. Alternatively use Settings → About → Prepare update… with the extracted destination. Settings, libraries and playlists are preserved. Do not replace your data folder with an empty one.

Early access. macOS apps are ad-hoc signed and not Apple notarized; Windows packages are unsigned. Matching decoder sources, notices and SHA-256 checksums accompany the release.
