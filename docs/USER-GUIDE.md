# Localtone user guide

[← Project home](../README.md) · [Downloads](https://github.com/shn1ggy/localtone/releases/tag/v0.131.0) · [Report a bug](https://github.com/shn1ggy/localtone/issues/new/choose)

## First run

1. Download the desktop package for your system. Extract the complete ZIP into a writable folder and open Localtone, or make the Linux AppImage executable and open it. Node.js is not required.
2. Choose **Add library…**, name your library, review its exclusion options and choose your music folder. Wait for the initial scan.
3. Use the artist pane to filter your collection. Browse **Albums**, **Covers** or **Tracks**, and double-click a track to play it.
4. Use the **+** beside Playlists to create a playlist. Drag tracks, albums or artists into a regular playlist. A dynamic playlist updates from its library rules or search expression.
5. Open **Settings → About** to check the version and active data folder. Appearance, browsing and keyboard preferences are in Settings.

Localtone edits real files when you rate MP3s, save tags or rename files. Try bulk operations on copies first. Session undo is available until exit; it is not a permanent backup.

## Browsing and playback

Artist grouping can use album artist (the app default), artist or parent folder. Selecting artists and typing a search filter what you see, without narrowing the normal playback queue. **All music** and dynamic playlists draw from libraries; files dropped directly into a regular playlist do not become part of All music.

Double-click a library, playlist or All music to start a random song from that complete collection. The queue follows the collection's sort order and current shuffle/repeat mode. Add to queue inserts the selection after the active track. The visible queue limit controls displayed rows, not the collection or shuffle pool.

Click the now-playing artwork to reveal the playing track in its original collection, keeping the current Albums/Covers/Tracks tab. The playing track takes priority when an entire album is too tall to fit. Clicking a cover in Albums expands/collapses it; clicking its title selects the album. In Covers, Enter opens selected albums; Backspace returns to the grid.

Right-click tracks, artists or albums for tag editing, queue/playlist actions, opening their location and file tools. Right-click a tab to show/hide column headings; right-click headings for column visibility and alignment. Pane dividers and waveform height can be dragged and locked through their context menus.

## Keyboard essentials

These are defaults; change them in **Settings → Shortcuts**. Ctrl means Ctrl on Windows/Linux and Cmd on Mac in this table.

| Action | Shortcut |
| --- | --- |
| Search | Ctrl+F |
| Play / pause | Space |
| Previous / next | Ctrl+Left / Ctrl+Right |
| Shuffled next | Ctrl+Shift+Right |
| Seek backward / forward | Alt/Option+Left / Right (5 seconds by default) |
| Rate selection | Ctrl+1–5; Ctrl+0 clears |
| Add selection to queue / playlist | A / + |
| Edit tags / rename | E / F2 |
| Shuffle / repeat mode | S / R |
| Cycle Albums, Covers, Tracks | X |
| Cycle sort / reset to default order | O / Shift+O |
| Show/hide column headings | Shift+X |
| Collapse/expand selection / all albums | C / Shift+C |
| Queue / mini player / maximize | P / M / F |
| Settings / quit | Ctrl+P / Ctrl+Q |
| New playlist / library | Ctrl+N / Ctrl+L |
| Undo / redo | Ctrl+Z / Ctrl+Shift+Z |
| Open context menu | Shift+Enter |

Tab switches between artist and content panes. Shift+Tab enters the library/playlist pane; arrows move and Enter opens a collection. Left/Right also cycle panes. In the artist/content panes, Up/Down navigate, Shift extends selection, and Ctrl+A selects all in that pane. Enter on an artist focuses its content; Enter on a track plays it. Backspace clears selection while retaining focus and navigation position. Escape clears selection and returns to the preceding pane; in search it cancels the search. Delete removes tracks from a regular playlist; file deletion is a separate confirmed action.

Context menus use Up/Down and Enter. Right enters a playlist submenu; Left returns. Escape closes the innermost menu/help/dialog first. Checkmarked menu options generally remain open so you can change several; single-option logo/column-heading menus close after toggling.

## Search and dynamic playlists

Use plain words or field expressions. **Settings → General → Search guide…** contains the full, current syntax. Boolean operators are uppercase; use quotes for phrases.

```text
artist:"Alder Coast" AND year:>=2020
rating:>=4
NOT genre:"Hip Hop"
missing:year OR missing:genre
missing:totaltracks
missing:leadingzeros
has:disc AND disc:>=2
```

Fields include artist, album artist (`albumartist`), album, title, year, genre, rating, duration, format, folder and disc. `has:` / `missing:` check tag presence, with additional track-number checks such as `totaltracks` and `leadingzeros`. Use AND, OR, NOT or EXCEPT and parentheses to combine conditions. Search never changes the normal playback queue.

Press Enter to confirm a search and expose **Create playlist from results** without changing the current tab. This creates a regular snapshot playlist. The button remains across tabs until you change/clear the search or switch collections.

For a live playlist, enable **Dynamic playlist** in its settings, choose a source library, then choose **Rules** or **Search expression**. Both modes share the same library source and match preview; switching preserves their settings. For example, `rating:>=4 AND missing:genre` stays up to date as tags change. Dynamic playlists cannot accept manual drops; files imported only into regular playlists are excluded.

## Updates and storage

Close Localtone. Extract the new version into a new folder. With portable mode enabled, copy your existing **Localtone-data** folder into the new program folder before starting. Keep the old folder until the update works. Existing settings, libraries and playlists take precedence over defaults. Never replace your data folder with an empty one.

Portable mode keeps app data beside the program; otherwise the OS application-data location is used. General Settings provides settings export/import and the existing portable migration/cleanup controls. Settings exports can include library and playlist references when Include playlists & libraries is enabled. Audio files, device-specific output choices and Last.fm credentials are not included. Session tag/rename undo ends when the app closes; settings backups are separate.

### Check and prepare an update

**Settings → About** shows the running version, build, OS/processor and actual data folder. For subsequent releases, extract the new app into a separate folder and choose **Prepare update…** in the old app. Select the extracted folder (the `.app` bundle on Mac), confirm, then quit the old version and start the new one. Localtone verifies release checksums and copies portable data automatically. System app-data mode remains system mode. The old app/data are retained, and existing destination data is never replaced.

Preparation copies a snapshot and pauses playback; quit promptly afterward. Source releases still need `npm ci` before `npm start`. Use releases from a trusted source; checksums detect corruption and are not publisher signatures.

About → **Check for updates** offers a compatible verified desktop ZIP from public GitHub Releases. Early-access versions also check published pre-releases. Download, extract and use Prepare update… to transfer portable data. Localtone does not replace itself or restart automatically. No GitHub credentials are needed. Versions 0.116–0.117 need one manual update if they report “Redirect was cancelled”.

## Move a library to another computer

1. In General Settings, enable **Include playlists & libraries**, then export settings.
2. Copy/sync the music while keeping the folders and filenames inside each library unchanged.
3. Import the settings on the other computer.
4. Right-click each imported library → **Reconnect folder…**, choose its new root folder and confirm the matching files.

Playlist membership/order and dynamic rules are preserved. Ensure cloud files are downloaded locally before reconnecting. Reconnect the imported library rather than deleting and recreating it. New backups retain file sizes; older size-less backups are verified using song details and duration.

## Clean start on macOS

Put `Localtone.app` in its own writable folder (for example `~/Applications/Localtone/`) without an existing `Localtone-data` folder. A new portable folder starts with defaults and never imports old system data automatically. Portable mode is enabled initially; Settings → General lets you import exported preferences or change storage mode. Existing `Localtone-data` is always preserved. Use Settings → About to see and open the exact active data folder. General → Old app data → Remove… removes the previous system-data folder after making a verified backup inside portable data. Quit before manually moving any data folders; move them aside rather than deleting them if you might need their library or credentials.

## Shared music folders and cache cleanup

Localtone quietly reconciles normal library folders at startup, when you return to the app, and every 30 seconds while the app is focused and no dialog is open. New audio files are discovered; unavailable files are hidden from browsing, artist/album panes, dynamic playlists and new playback queues. Their saved records and regular-playlist references remain recoverable if a drive or synced file returns. Individual file imports into playlists refresh only their explicitly imported files, never other files in those folders.

Unchanged size/mtime reuses cached metadata. MP3 ratings and tags edited by another app or computer update after syncing finishes locally. Modified-date rules use filesystem modification time, not download time. Edits preserving both size and modification time are not detected by this comparison. Automatic refreshes use a background metadata worker and do not display indexing notifications.

General → Settings & storage → Cache → Clean unused removes artwork no longer referenced by the index and waveforms for older file versions. It retains current caches, settings, playlists, music files and undo history, and uses the selected data folder in portable mode too.

## Repair externally renamed files

General → Library → Unavailable files → Review… lists old paths that are unavailable. Each entry offers suggested replacements already in the same library, based on file size, duration and tags. These are hints: select the correct recording and press Reconnect…, or leave Choose file… selected to locate it manually. The replacement must be inside this library; use Reconnect folder… if the whole library moved.

After confirmation, Localtone preserves the original track ID and playlist membership, reads the replacement's current tags/rating, and merges an already indexed replacement. Forget entry… removes only an obsolete missing record and its playlist/queue references; it never deletes a music file. A missing file is not assumed deleted automatically. Localtone's own Rename files & folders keeps references up to date; external renames appear under their new path automatically, but use this explicit repair if you want to carry the original entry’s playlist references across.

## Edit tags

Select tracks, albums or artists and press **E**, or choose **Edit tags…** from the context menu. Shared values appear normally; differing values show a multiple-values hint. Edit only the fields you want to apply to the whole selection. Untouched mixed fields remain unchanged; explicitly clearing a field removes it. The Tags and Track numbers sections remember whether you left them expanded.

For MusicBrainz suggestions, choose the relevant album and release, review the proposed values, and enable only the fields you want copied. Unmatched tracks and fields you leave disabled remain unchanged. Track-number matching shares this review and Save action. A database match is a proposal, not proof that you have that exact edition.

Save validates the edits and may ask for multi-file confirmation (configurable in Settings). The window then closes while writes finish in the background; watch the progress/status and review any reported failures. Session undo/redo remains available until exit. Avoid editing the same files in another app while writes finish.

## Rename only names that differ

Rename files & folders → Preview lists only valid proposed changes. Already matching names are counted, not listed. Missing files, destination collisions, conflicting album metadata and invalid names are reported in the expandable skipped-problems list without blocking unrelated valid previews. Use the per-row switches to choose changes. Special characters lets you save safe replacements for `?`, `/` and other forbidden characters, or leave each replacement empty to remove it. Metadata stays unchanged. Rename applies only enabled listed changes and supports session undo/redo. Conflicting or unchanged names are not renamed. Changes made externally after a preview require previewing again; no existing destination is overwritten. Album-folder moves still include the folder's contents.

## Duplicate files and disc tags

General → Library → Find duplicates scans indexed available files across collections. Identical file contents verifies the entire file with SHA-256, so files with different tags will not match this mode. Artist, title & duration finds possible matches (duration rounded to seconds); these may be different recordings. Enable only files you want removed, retain one copy per group, then confirm Move selected to Trash. Playlist references to removed files are deleted; restoring a file from system Trash does not restore those playlist memberships automatically.

Search `has:disc` or `has:discnumber` for explicit disc-number tags, `missing:disc` for absent tags, and `disc:2` or `disc:>=2` for tagged disc numbers. Presence checks also support other fields, such as `has:genre`. The same expressions work in dynamic playlists. Album views separate consecutive discs with a subtle line. Existing indexed tracks read raw disc tags on their next scan; normal libraries refresh automatically.

## Track-number commands

Renumber by folder order is available for one complete MP3 album, including when all its tracks are selected in a track view. A partial/search-filtered album or selection spanning albums cannot be renumbered. Natural folder/filename order determines sequential numbers, starting at 1 per tagged disc unless General → Library → Ignore discs for renumbering is enabled. Renumbering also corrects totals and uses the saved leading-zero preference. Other tags and audio remain unchanged, with session undo/redo. Add total tracks fills missing/invalid totals only. Add/Remove leading zeros affect both number and total components. These formatting commands are disabled when none of the selected tracks needs the change.

For mixed tag values, focus the row and press Delete or Backspace to clear it for all selected files. The multiple-values hint disappears to show the pending removal. Typing and then clearing a row works too. Untouched mixed rows remain unchanged; multi-file confirmation and undo still apply.

## Privacy and troubleshooting

Optional Last.fm scrobbling, MusicBrainz lookups and update checks use online services. See [Privacy](../PRIVACY.md) for what is sent and stored. Audio output selection is in Settings → Audio; available devices depend on your system.

For a bug report, include the version/OS/processor from About, reproduction steps, view/grouping/sort and audio format. Remove private paths and credentials. [Open a report](https://github.com/shn1ggy/localtone/issues/new/choose). Broader hardware and accessibility validation is ongoing; see [release readiness](../RELEASE-READINESS.md).
