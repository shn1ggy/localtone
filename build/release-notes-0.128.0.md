# Localtone 0.128.0 — unpublished Windows test build

- Keep music playing when saving a rating, including while seeking after the write. MP3 ratings and session undo remain available immediately.
- Preserve one now-playing footer layout throughout normal/mini window changes.
- Preserve fractional viewport dimensions and update only changed native bounds to avoid Windows rounding shifts at 130% scaling.
- Reveal the extended queue from its left edge toward its right edge. Keep the main window in place; use overlay when there is no space to extend right.
- Prioritize the playing track when clicking the now-playing cover, including on albums too long to fit their heading and active track together.
- Check geometry during transitions and extend Windows checks to 130% display scaling with hardware acceleration enabled.

Publication remains on hold pending user testing. Saved preferences are preserved.
