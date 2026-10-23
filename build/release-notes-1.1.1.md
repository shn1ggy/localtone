# Localtone 1.1.1

Faster playback starts and improved gapless transitions.

- **Start listening sooner.** Playback starts from a small audio buffer instead of waiting for the entire song to be decoded or copied. Long tracks use bounded audio buffers.
- **Smoother gapless playback.** Prepared tracks join on the audio clock. Skipping to a track that is already being prepared reuses that work.
- **More reliable seeking.** MP3 seeking includes decoder preroll to avoid artifacts after a jump.
- **Keep listening while editing.** Ratings and tag edits protect the active audio stream without deliberately pausing the song. Decoder processes finish releasing files before writes and shutdown.
- **Playback takes priority.** Cached waveforms appear immediately; new waveform analysis waits until playback has started.

Your settings, libraries, playlists and existing gapless preference are preserved. Enable Gapless playback in Settings → Audio for prepared transitions between songs.

Automated playback, sample-continuity and interface checks pass on Windows, macOS and Linux. Physical audio-device testing, including Bluetooth, remains important; these checks do not certify every device or driver.

## Updating

Use Settings → About → Check for updates, or download the complete desktop ZIP for your system. Quit Localtone before replacing app files. Keep your existing Localtone-data folder; do not replace it with an empty one. Settings → About → Prepare update… can transfer your data to a separately extracted app folder.

Mac builds are ad-hoc signed, not Apple notarized; Windows builds are unsigned. Matching decoder sources, notices and SHA-256 checksums accompany the release.
