# Localtone 0.131.0 — Windows test candidate

Unpublished test build; public release remains 0.127.0.

- Clip document-level overflow so fractional native resizing cannot add a horizontal scrollbar or reduce the usable height.
- Correct width-induced Windows frame rounding even at minimum window height, restoring minimum constraints afterwards.
- Commit compositor suppression over two animation frames before mini-player resizing, keeping non-player chrome hidden until the final layout is ready. No visual snapshots.
- Close the confirmed tag editor immediately, show background preparation/save progress, preserve undo, and expose errors through Review. Reopening after a partial failure restores normal editable controls. Keep the active playback position safe while a file is temporarily released, and do not overwrite a newly playing track's labels on save completion.

Includes all pending 0.128–0.130 fixes. Preserve settings and music.
