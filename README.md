# Localtone

A compact local music player for macOS, Windows and Linux. **0.114.0 — early access.**

## Download

[All downloads and release notes](https://github.com/shn1ggy/localtone/releases/tag/v0.114.0)

| System | Download |
| --- | --- |
| macOS · Apple Silicon | [App ZIP](https://github.com/shn1ggy/localtone/releases/download/v0.114.0/Localtone-0.114.0-mac-arm64.zip) |
| macOS · Intel | [App ZIP](https://github.com/shn1ggy/localtone/releases/download/v0.114.0/Localtone-0.114.0-mac-x64.zip) |
| Windows · 64-bit | [App ZIP](https://github.com/shn1ggy/localtone/releases/download/v0.114.0/Localtone-0.114.0-win-x64.zip) |
| Linux · 64-bit | [AppImage](https://github.com/shn1ggy/localtone/releases/download/v0.114.0/Localtone-0.114.0-linux-x86_64.AppImage) |

These desktop packages include everything needed to run Localtone; Node.js is only needed to work with the source. Extract the complete ZIP, or make the Linux AppImage executable. Windows portable EXE and Linux ZIP are also on the release page. These early-access builds are unsigned and not notarized.


This is an early-access development build. Native platform validation and third-party redistribution review are still pending; see [RELEASE-READINESS.md](RELEASE-READINESS.md).

## Run

Install Node.js **24 LTS, version 24.15 or newer** (this release was verified on 24.19.0; the exact supported ranges are in package.json), extract this folder, then open a terminal here:

```sh
npm ci
npm start
```

This download contains source code, not a signed installer. Build a launchable desktop package on its target operating system:

```sh
# First build the pinned decoder; see build/ffmpeg/README.md
npm run release:mac
npm run release:win
npm run release:linux
```

The commands run verification first and write versioned packages to `dist`: a macOS app ZIP, Windows ZIP/portable EXE, or Linux ZIP/AppImage. Native packages run without Node.js. See **RELEASING.md** for architecture selection, signing and update instructions.

## Update safely

Close Localtone. Extract the new version into a new folder. With portable mode enabled, copy your existing **Localtone-data** folder into the new program folder before starting. Keep the old folder until the update works. Existing settings, libraries and playlists take precedence over defaults. Never replace your data folder with an empty one.

Portable mode keeps app data beside the program; otherwise the OS application-data location is used. General Settings provides settings export/import and the existing portable migration/cleanup controls. Exported preferences do not contain your music library, device-specific output choice or Last.fm credentials. Session tag/rename undo ends when the app closes; settings backups are separate.

## About and prepared updates

**Settings → About** shows the running version, build, OS/processor and actual data folder. For subsequent releases, extract the new app into a separate folder and choose **Prepare update…** in the old app. Select the extracted folder (the `.app` bundle on Mac), confirm, then quit the old version and start the new one. Localtone verifies release checksums and copies portable data automatically. System app-data mode remains system mode. The old app/data are retained, and existing destination data is never replaced.

This assistant starts with version 0.90; when moving from an older version without it, use the manual update instructions above once. Preparation copies a snapshot and pauses playback; quit promptly afterward. Source releases still need `npm ci` before `npm start`. Use releases from a trusted source; checksums detect corruption and are not publisher signatures.

## Main features

- Local libraries and manual or dynamic playlists, with artist, album-list, cover and track browsing.
- Metadata-based and folder-based artist grouping; configurable sorting, columns and keyboard shortcuts.
- Search expressions shared with dynamic playlists. Open **Settings → General → Search guide…** for the complete syntax.
- MP3 tag editing, optional MusicBrainz proposals, track-number review, and previewed file/folder naming.
- Ratings stored in files, session undo/redo, waveform seeking, output selection, optional gapless playback and Last.fm scrobbling.
- Mini player, overlay or extended queue, saved appearance and portable storage.

The queue display limit controls visible rows, not playlist membership or the shuffle pool. Display sorting is available in all three views. Selecting artists filters browsing without reducing the normal playback queue; search never reduces the playback queue.

## Development and checks

```sh
npm run verify
npm run benchmark
```

`verify` runs lint, formatting checks and the automated suite. `npm run format` formats runtime sources. See **DESIGN.md** for UI rules, **RENDERER-STRUCTURE.md** for module ownership, **MAINTENANCE.md** for audit results, **RELEASE-READINESS.md** for public-release blockers and the roadmap, and **CHANGELOG.md** for release history.

Real audio, global shortcuts, platform window behavior and signing must also be checked on the target systems. Headless tests do not establish gapless sound quality or GPU smoothness.


### Clean start on macOS

Put `Localtone.app` in its own writable folder (for example `~/Applications/Localtone/`) without an existing `Localtone-data` folder. A new portable folder starts with defaults and never imports old system data automatically. Portable mode is enabled initially; Settings → General lets you import exported preferences or change storage mode. Existing `Localtone-data` is always preserved. Use Settings → About to see and open the exact active data folder. General → Old app data → Remove… removes the previous system-data folder after making a verified backup inside portable data. Quit before manually moving any data folders; move them aside rather than deleting them if you might need their library or credentials.

### Shared music folders and cache cleanup

Localtone quietly reconciles normal library folders at startup, when you return to the app, and every 30 seconds while the app is focused and no dialog is open. New audio files are discovered; unavailable files are hidden from browsing, artist/album panes, dynamic playlists and new playback queues. Their saved records and regular-playlist references remain recoverable if a drive or synced file returns. Individual file imports into playlists refresh only their explicitly imported files, never other files in those folders.

Unchanged size/mtime reuses cached metadata. MP3 ratings and tags edited by another app or computer update after syncing finishes locally. Modified-date rules use filesystem modification time, not download time. Edits preserving both size and modification time are not detected by this comparison. Automatic refreshes use a background metadata worker and do not display indexing notifications.

General → Settings & storage → Cache → Clean unused removes artwork no longer referenced by the index and waveforms for older file versions. It retains current caches, settings, playlists, music files and undo history, and uses the selected data folder in portable mode too.

### Repair externally renamed files

General → Library → Unavailable files → Review… lists old paths that are unavailable. Each entry offers suggested replacements already in the same library, based on file size, duration and tags. These are hints: select the correct recording and press Reconnect…, or leave Choose file… selected to locate it manually. The replacement must be inside this library; use Reconnect folder… if the whole library moved.

After confirmation, Localtone preserves the original track ID and playlist membership, reads the replacement's current tags/rating, and merges an already indexed replacement. Forget entry… removes only an obsolete missing record and its playlist/queue references; it never deletes a music file. A missing file is not assumed deleted automatically. Localtone's own Rename files & folders keeps references up to date; external renames appear under their new path automatically, but use this explicit repair if you want to carry the original entry’s playlist references across.

### Rename only names that differ

Rename files & folders → Preview lists only valid proposed changes. Already matching names are counted, not listed. Missing files, destination collisions, conflicting album metadata and invalid names are reported in the expandable skipped-problems list without blocking unrelated valid previews. Use the per-row switches to choose changes. Special characters lets you save safe replacements for `?`, `/` and other forbidden characters, or leave each replacement empty to remove it. Metadata stays unchanged. Rename applies only enabled listed changes and supports session undo/redo. Conflicting or unchanged names are not renamed. Changes made externally after a preview require previewing again; no existing destination is overwritten. Album-folder moves still include the folder's contents.

### Duplicate files and disc tags

General → Library → Find duplicates scans indexed available files across collections. Identical file contents verifies the entire file with SHA-256, so files with different tags will not match this mode. Artist, title & duration finds possible matches (duration rounded to seconds); these may be different recordings. Enable only files you want removed, retain one copy per group, then confirm Move selected to Trash. Playlist references to removed files are deleted; restoring a file from system Trash does not restore those playlist memberships automatically.

Search `has:disc` or `has:discnumber` for explicit disc-number tags, `missing:disc` for absent tags, and `disc:2` or `disc:>=2` for tagged disc numbers. Presence checks also support other fields, such as `has:genre`. The same expressions work in dynamic playlists. Album views separate consecutive discs with a subtle line. Existing indexed tracks read raw disc tags on their next scan; normal libraries refresh automatically.

### Track-number commands

Renumber by folder order is available for one complete MP3 album, including when all its tracks are selected in a track view. A partial/search-filtered album or selection spanning albums cannot be renumbered. Natural folder/filename order determines sequential numbers, starting at 1 per tagged disc; existing leading-zero widths and valid totals remain intact. Other tags and audio remain unchanged, with session undo/redo. Add total tracks fills missing/invalid totals only. Add/Remove leading zeros affect both number and total components. These formatting commands are disabled when none of the selected tracks needs the change.

For mixed tag values, focus the row and press Delete or Backspace to clear it for all selected files. The multiple-values hint disappears to show the pending removal. Typing and then clearing a row works too. Untouched mixed rows remain unchanged; multi-file confirmation and undo still apply.

## Project and privacy

Project repository: [shn1ggy/localtone](https://github.com/shn1ggy/localtone). Source, tests and release workflows are public. The first verified early-access desktop downloads are available under Releases. Check [GitHub Actions](https://github.com/shn1ggy/localtone/actions) for verification results.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and bug reports, [PRIVACY.md](PRIVACY.md) for network/data behavior, and [LICENSING.md](LICENSING.md) for the agreed GPL-3.0-or-later project license and remaining third-party distribution review.

Native releases verify the application and FFmpeg processor and include a packaged dependency/notices inventory. See RELEASING.md for download verification and the first GitHub pre-release checklist.

## License

Localtone-owned code and original project assets are licensed under **GPL-3.0-or-later**. See [LICENSE](LICENSE) for the license text and [LICENSING.md](LICENSING.md) for the application notice and third-party redistribution checklist.

Double-click a playlist to play a random song with the full collection queue and current playback mode. Ctrl/Cmd+Q quits. Backspace clears Artist/Tracks selection while keeping focus and navigation position; Delete removes tracks from regular playlists. Appearance includes shared Primary text and Secondary text colors, restored by Reset appearance.

About → Check for updates checks public stable GitHub Releases and offers the matching verified desktop ZIP. After downloading, extract it and use Prepare update… to transfer portable data. The app does not replace itself or restart automatically. Update checks follow stable releases; early-access pre-releases are downloaded from the release page. No GitHub credentials are embedded or requested.
