# Localtone UI work

Read DESIGN.md before creating or changing any dialog, preferences page or context menu. Reuse existing components and preserve saved values and keyboard behavior. Verify visual changes in Electron at 100% zoom; DOM tests alone do not verify rendering.


Double-clicking a library, All music or a playlist chooses a random track from that complete collection and seeds its full queue in the current sort/shuffle mode. Artist and search filtering must not restrict this queue.
