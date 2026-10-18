Localtone 0.123.0 fixes library migration and direct now-playing reveal.

- Settings backups with collections now preserve valid file sizes and raw disc tags. Import → Reconnect folder… retains track/library identities, playlist order and dynamic rules, while refreshing MP3 ratings from the current files when the music root differs. Internal artist/album/file paths must remain the same.
- Older backups with zero/missing sizes reconnect using readable audio details and duration. Changed/mismatched or unreadable files cancel verification; no music is moved or deleted. Verification uses up to eight concurrent read-only tasks, and cancellation/failures preserve the existing collection.
- Tested complete export → import → reconnect → restart workflows for new backups and older Windows-path backups at a different folder location, including rejected/cancelled reconnects.
- Clicking now-playing artwork preserves the current tab and playing collection, clears artist filtering, selects the playing track, and aligns its album heading/cover to the top in Albums/cover detail, or its row below visible column headings in Tracks. Minimal temporary trailing room allows alignment near the end of a collection. In-place changes and playback navigation within the same collection keep that room; collection/search/view changes clear it. Next/Previous and shuffled-next retain nearest-edge scrolling.

From 0.118 or newer, use Settings → About → Check for updates, download/extract, then Prepare update… to copy portable data when moving to a new folder. Downloading does not install or restart automatically. Quit before replacing an app in place and preserve Localtone-data.

Mac downloads are ad-hoc signed and verified in native CI, not Developer ID signed or notarized. Windows/Linux packages, application and decoder sources, and SHA-256 checksums are included.
