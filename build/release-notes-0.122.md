Localtone 0.122.0 fixes rating scroll jumps and album-range selection.

- Rating shortcuts and mouse stars preserve track-pane and artist-pane scrolling during the immediate update, after saving, and when a save fails. Moving or navigating while a save is pending keeps the latest position. Surviving focused rows retain keyboard focus without a focus pulse.
- Shift/Ctrl/Cmd selection through album title areas highlights every track belonging to all selected albums, and clears stale track highlights when an album is deselected. Collapsed albums keep the complete logical selection for tag editing, ratings and queue actions.
- Related in-place updates now preserve scrolling: column order/width/alignment/visibility changes, album-info toggles, tag/file updates and rescans, periodic date-rule playlist refreshes and relevant appearance updates. Collection, search and view navigation keep their existing intentional behavior.
- Virtual track rows refresh synchronously after restoring the viewport; lazy album mounting uses the preserved position.

From 0.118 or newer, use Settings → About → Check for updates, download/extract, then Prepare update… to copy portable data when moving to a new folder. Downloading does not install or restart automatically. Quit before replacing an app in place and preserve Localtone-data.

Mac downloads are ad-hoc signed and verified in native CI, not Developer ID signed or notarized. Windows/Linux packages, application and decoder sources, and SHA-256 checksums are included.
