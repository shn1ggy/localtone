# Localtone 0.130.0 — Windows test candidate

Unpublished test build; the public release remains 0.127.0.

- Restore saved queue order, repeated entries, origins, shuffle/repeat mode and paused position instead of rebuilding the queue.
- Restore browsing tabs, selections, focus, album expansion, pane scrolls and queue visibility, plus deselected keyboard anchors and mini-player mode.
- Save the renderer session before application-quit cleanup, including the title-bar X button, and wait for pending preferences.
- Keep queue scroll unchanged on manual queue clicks and unrelated browsing redraws.
- Correct Windows frame-height drift during horizontal queue expansion.
- Remove stale audio-cache deletion and Last.fm credential loading from the startup critical path. Restore queues without entrance animation; save bounded startup timings in logs/startup.json.

Includes pending 0.128/0.129 playback and Windows transition fixes. Preferences and music are preserved.
