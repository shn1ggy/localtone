# Localtone 1.1.0

Cleaner tags and a few small conveniences.

- **Comments.** The tag editor has a Comment field. If you like, Settings → Appearance → Show comments after titles shows each comment in parentheses right after the track title, in the same dimmer colour as track numbers and durations. It is off by default.
- **Remove other tags.** The tag editor now lists every tag its fields do not cover, such as publisher, encoder settings, catalogue numbers, iTunes data or old ID3v1/APE blocks. One click on Remove other tags, then Save, removes them from all selected files. Artwork and ratings are always kept (and not listed), and the change can be undone until you quit.
- Legacy tag cleanup preserves editable fields and artwork before removing old metadata blocks.
- **Add your own tag fields.** Add field… in the tag editor adds fields such as Composer, BPM, Publisher or any custom name. They stay in the editor until you remove them.
- **Search by bitrate and comment.** Try `bitrate:320`, `bitrate:<256`, `bitrate:192-256` or `comment:vinyl`. `has:` and `missing:` work with both, and dynamic playlists can filter by bitrate.
- **Repair missing files in bulk.** In Settings → General → Library → Missing files → Review…, the best match for each missing file is preselected. Tick several entries (Shift-click selects a range, or use Select all / Select all with a match) and reconnect or forget them together. Localtone shows every planned change in its own window before anything happens; no more Windows prompts, one click per file.
- **Open a library's folder** from its right-click menu.
- **Hide the logo** from its right-click menu; the library list moves up. Settings → Appearance → Show logo, or right-clicking the Libraries heading, brings it back.

**Fixed:** "operation not permitted, rename …" errors that could appear when the Localtone folder is inside Dropbox or OneDrive. Localtone now waits a moment for the sync app to release the file. The play-queue context menu no longer runs off the bottom of the window.

After updating, Localtone reads bitrates and comments for your existing music once in the background. On very large libraries this takes a few minutes after the first start; until it finishes, bitrate searches may miss some tracks, and saving tags or playlist changes may wait briefly.

## Updating

Quit Localtone before updating. Extract the complete desktop ZIP into a writable folder and keep your existing Localtone-data folder beside Localtone.exe or Localtone.app. Alternatively use Settings → About → Prepare update… with the extracted destination. Settings, libraries and playlists are preserved. Do not replace your data folder with an empty one.

macOS apps are ad-hoc signed and not Apple notarized; Windows packages are unsigned. Matching decoder sources, notices and SHA-256 checksums accompany the release.
