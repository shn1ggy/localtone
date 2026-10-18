Localtone 0.119.0 improves safe quitting, pane focus, tag batches and folder-order renumbering.

- Quit requests now enter the safe shutdown path even during library updates or saves. Active work finishes before exit. Other busy notices use simple language, and popup text omits Electron’s technical IPC prefix.
- Artist/track focus flashes meet at the exact left edge of the Albums toolbar and stop above the waveform. Sidebar feedback retains its full height; visible queues remain excluded.
- Preferences tabs keep their selected-tab styling without an extra underline during keyboard navigation.
- Batch tag validation and writing process up to two MP3 files concurrently with bounded memory. All files are validated before writing, active tasks finish before a validation error is returned, and external-change protection and session undo are preserved. The editor closes before the final library repaint. Actual save time still depends on file sizes and storage.
- Folder-order renumbering corrects track totals per disc, or for the full album when Ignore discs is enabled. It also applies the saved leading-zero preference, now labelled Leading zeros for renumbering and totals. Existing preference values and other tags remain intact.

0.118’s updater correction is retained. In 0.118, use Settings → About → Check for updates, download/extract, then Prepare update… to copy portable data when moving to a new folder. Downloading does not install or restart automatically. Versions 0.116–0.117 need one manual download because their updater can cancel redirects. Quit before replacing an app in place and preserve Localtone-data.

Mac downloads are ad-hoc signed and verified in native CI, not Developer ID signed or notarized. Windows/Linux packages, application and decoder sources, and SHA-256 checksums are included.
