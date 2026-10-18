# Localtone 0.127.0

- Library creation includes name and exclusion settings before the first scan. Existing libraries have Library settings… in their context menu, with exclusions for folder names, file types, filename patterns and dot-prefixed folders.
- Add library and Import settings share the same button dimensions and text weight. Focus restoration no longer adds underlines or hides button text.
- Windows extended queues reveal smoothly without repeated native resizing. Queue and mini-player toggles preserve normal window size and position, including scaled displays; paint waits cannot stall indefinitely.
- Empty artist, album and track messages share typography and brightness. Playing album titles remain highlighted when albums are collapsed.
- Context-menu commands and playlist submenus share compact sizing and only scroll when necessary. Delete files follows Rename files.
- Albums are expanded by default on new installations. Existing preferences are preserved.

Validation: 365 behavior tests pass on Windows, macOS and Linux. Native Windows checks at 100% app zoom cover 100% and 125% display scaling, ten interleaved queue/mini-player round trips, button geometry, Escape and folder-picker cancellation, and initial library exclusions. Native packages and download checksums were verified on each target platform.

Early access. macOS packages are ad-hoc signed and not notarized. Existing settings and music files are preserved.
