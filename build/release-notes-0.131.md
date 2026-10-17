# Localtone 0.131.0

A reliability update for playback, session restoration and Windows window behavior.

- Restore the complete playback queue, repeated entries, collection origins, playback mode and stopped song/time. Restore browsing tabs, selections, focus, album expansion, pane scrolls and queue visibility. Title-bar close and Ctrl/Cmd+Q finish saving before exit.
- Fix normal-playback interruptions caused by seeking and cancelled audio requests. Rating the playing track no longer reloads its audio source.
- Show the cached collection before background folder checks finish. Keep cache cleanup and Last.fm credential loading off the startup critical path.
- Preserve queue scrolling when manually starting a queued track. Prevent document-level horizontal scrollbars and correct Windows frame rounding, including queue extension at minimum window height.
- Hide and paint non-player chrome before mini-mode resizing; retain the same artwork, information and controls without visual snapshots.
- Close the confirmed tag editor immediately and save in the background with progress, error review and session undo. Reopening after a partial failure restores editable controls. Completion does not replace a different now-playing track's title.
- Align empty-state messages across browsing views. Preserve existing settings and music.

Validation: 384 tests pass on Windows, macOS and Linux. Native Windows checks at 100% app zoom cover 100%, 125% and 130% display scaling, repeated queue/mini toggles, queue height at the native minimum, document overflow and player geometry. The project owner approved the tested candidates for publication; broader hardware coverage remains ongoing.

## Updating

Quit Localtone before updating. Extract the complete desktop ZIP into a writable folder and keep your existing Localtone-data folder beside Localtone.exe or Localtone.app. Alternatively use Settings → About → Prepare update… with the extracted destination. Settings, libraries and playlists are preserved. Do not replace your data folder with an empty one.

Early access. macOS apps are ad-hoc signed and not Apple notarized; Windows packages are unsigned. Matching decoder sources, notices and SHA-256 checksums accompany the release.
