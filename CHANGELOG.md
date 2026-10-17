# 0.132.0

- Faster browsing with large libraries: the Albums view opens, switches and searches in under half a second instead of 15–20 s at 50,000 tracks; Covers view loads artwork only near the viewport; folder sorting, sidebar totals and track starts no longer rescan the whole collection.
- Settings and ratings save to a small `collection-state.json` instead of rewriting the full collection file; read-only actions no longer copy the whole collection first.
- Library scans read four files at a time with unchanged results; very large folders no longer overflow the stack.
- Windows mini player is a separate, always-drawn window: M switches instantly without resizing or redrawing the main window, keeps the play queue as it was, and the full window follows the mini player when it is moved.
- First-launch buttons, sort menu and toolbar chips share the main-window 12px text and 5px corners; dialog labels and primary buttons follow the shared dialog styles; empty artist-pane messages align with artist names.
- Remove 547 stylesheet declarations that could never apply (computed styles verified identical across 16 screens).
- Startup timeline in `logs/startup.json`; window-transition diagnostics in source runs.

# 0.131.0

- Restore complete playback queues, current song/time and browsing sessions across exit/restart, including duplicate queue entries and pane scrolls.
- Fix cancelled normal-audio seeks and rating interruptions; show cached libraries before background directory checks finish.
- Preserve manual queue-click scroll. Prevent document scrollbars and correct Windows resize rounding at minimum height.
- Commit non-player chrome suppression before mini-mode resizing, without snapshots.
- Save confirmed tag edits in the background after closing the editor, with progress, persistent error review and unchanged undo/write verification.
- Preserve settings and music. 384 tests pass across the three operating systems; native Windows UI checks cover 100%, 125% and 130% display scaling.

See [release notes](https://github.com/shn1ggy/localtone/releases/tag/v0.131.0) for downloads and update instructions.

## 0.114.0

- Build release decoders from pinned FFmpeg 9.0.2 source on all platforms. Reject nonfree or unverifiable decoders during packaging. Include matching source, actual configuration, licenses and build instructions with release downloads.
- Smoke-check waveform and gapless PCM decoding before native packaging.

# 0.112.0

- Up/Down closes playlist submenu previews and continues through the parent context menu, including empty destinations.
- Now-playing artwork clears the artist filter while retaining the viewing tab and playing collection.
- Align pane-focus feedback with content edges instead of highlighting inter-pane padding.
- Start queue feedback before queue rendering; use immediate outward easing and a separate smooth return, retaining the 300ms stagger and reduced-motion support.
- Release extended queue spacing and the frozen layout together to avoid a transient waveform width change.

# 0.111.0

- Add About → Check for updates using the fixed GitHub Releases feed, matching stable desktop ZIPs to the current OS and processor.
- Show release notes, download progress and cancellation; verify byte count and SHA-256 before publishing the downloaded file. Preserve existing downloads and remove temporary files on failure, cancellation or normal exit.
- Keep extraction and launch explicit through the existing Prepare update workflow. Automatic replacement/restart is not enabled; the private repository currently has no public release feed.
- Include the browsing session in portable update preparation and save it before transferring data.

# 0.110.0

- Double-click a sidebar playlist to start a random song, retaining its complete queue, sorting and shuffle/repeat mode.
- Use Ctrl/Cmd+Q to quit; migrate the previous default without colliding with custom shortcuts.
- Backspace clears artist/track/album selection while preserving pane focus, scroll and the last navigation position. Delete retains playlist removal; unselected cover detail retains Backspace as Back.
- Add Primary text and Secondary text appearance colors, shared across browsing and every dialog, with existing neutral defaults, derived dim details, live preview, saved preferences and appearance reset.
- Document the GitHub-hosted update path and its portable/native packaging requirements. No online updater or public release is enabled.

# 0.109.0

- Fix Windows ASAR path normalization in the packaged dependency/notices audit, found by the first GitHub verification run. Cover Windows-style archive listings on every test host.
- Configure the owner-supplied GitHub repository, homepage and issue links.
- Identify MusicBrainz requests with the current app version and project URL instead of a stale hard-coded version/personal-player label.
- Correct project/license documentation and prepare the initial upload inventory. Remote upload and CI require authenticated GitHub access.

# 0.108.0

- Clicking the now-playing artwork preserves the active Albums, Covers or Tracks tab and selects/reveals the playing song in its original collection.
- Covers opens the playing album detail within Covers and retains the grid return position. View-preserving transport navigation also keeps Covers active.
- Preserve saved preferences and the full playback queue.

# 0.107.0

- Apply the owner-approved GPL-3.0-or-later license to Localtone-owned code and original assets.
- Include the GPL text and licensing notice in source and desktop packages; retain separate third-party terms.
- Update package metadata, README, contribution and release guidance to reflect the license decision.
- No saved preferences, music files or UI defaults changed.

# 0.106.0

- Native builds reject application/FFmpeg processor mismatches and verify the decoder on the target host.
- Packaged binary/version evidence and production dependency notices accompany each desktop build.
- Native archives include standard SHA-256 checksum lists; the GitHub test-package workflow verifies downloads before uploading.
- Added a download verification command and step-by-step first GitHub pre-release checklist.
- No saved preferences, music files or UI defaults changed.

# 0.105

- Fix portable/system migration of browsing sessions and protect source archives from data backups/signing material. Include deliberate GitHub configuration files.
- Restore the 5,000-track benchmark and correct supported Node versions.
- Show the first-run Add folder action in every view, retain shortcut-editor focus, add meaningful shortcut/switch accessibility labels and ignore IME composition keys.
- Align playlist width with shared dialogs; correct guide-link padding, rule text measurement and neutral empty-state color. Add restrained keyboard-only focus cues without outlines.
- Expand design rules with focus, empty/error/loading, scaling, contrast and review-state contracts.
- Prepare GitHub CI/build-preview workflows, issue templates and dependency updates; add release readiness, privacy, contribution and licensing documentation. No public publication or project license selection is included.

# 0.104

- Make Delete/Backspace in an empty mixed-value tag field explicitly clear that tag from every selected file. Clear the multiple-values hint, retain changed-row feedback and expose an accessible pending-removal description.
- Preserve untouched mixed rows, multi-file confirmation, other metadata/audio and session undo/redo.

# 0.103

- Add Renumber by folder order for one complete MP3 album, assigning natural folder-order track numbers per disc while retaining existing padding, valid totals, other tags/audio and session undo/redo. Reject incomplete, unavailable and cross-album selections in both menu and main process.
- Rename Add missing total tracks to Add total tracks and place renumbering above it. Disable total and leading-zero commands when no selected track needs a change; mixed selections still update eligible entries only.
- Expand the Search guide with a Tags present section, supported has: fields, raw-tag/fallback distinctions, NOT/missing equivalence and combined presence-query examples for browsing and dynamic playlists.

# 0.102

- Add General → Library → Find duplicates, with byte-identical SHA-256 matching or clearly labelled possible artist/title/duration matches. Removal switches start off, retain at least one unchanged copy per group, revalidate sources, confirm selected paths and use system Trash. Remove only successfully trashed entries from playlists and the active queue.
- Separate disc-number transitions with subtle lines in album list/detail tables without changing row heights, virtualization or keyboard navigation.
- Index raw disc tags, including MP3 zero padding, and add disc/discnumber search comparisons plus has:field presence checks. Document has:disc, missing:disc and disc:2 in the search guide; Search expression dynamic playlists share the parser.
- Strengthen the reusable dialog switch rule against native checkbox sizing and preserve normal compact control geometry.

# 0.101

- Add saved per-character replacements for cross-platform special filename characters; empty values remove characters, while unsafe replacements are rejected. Metadata and extensions remain unchanged.
- Add right-aligned Use switches to valid rename preview rows. Apply only enabled file/folder changes, recompute displayed paths when folder changes are disabled, validate dependencies and preserve selective session undo/redo.
- Document shared replacement-row and selective-preview design rules. Keep unavailable-file recovery optional for preserving playlist references; retain automatic folder refreshes and the fast metadata index.

# 0.100

- Hide unavailable tracks from normal browsing, artist/album panes, regular and dynamic playlist views, counts and playback pools while retaining recoverable records and regular-playlist references.
- Quietly reconcile normal library folders on startup, returning to the app and every 30 seconds while focused without an open dialog. Discover additions and deletions, refresh changed tags, reuse unchanged metadata and preserve browse position. Individually imported playlist files never discover unrelated neighboring audio.
- Make batch naming previews partial: list valid changed names only, count already matching names, report missing files/conflicts/invalid names separately, and apply only valid changes. Rejected dependency chains remain skipped; swaps, overwrite prevention, fresh source checks, rollback and undo/redo remain supported.
- Rename optional recovery review to Unavailable files / Review and explain why saved unavailable records remain recoverable.

# 0.99

- Add individual missing-file reconnection using a file picker or suggested indexed replacements. Compare size, duration and metadata as hints; require confirmation, preserve the original ID, reread actual tags and merge duplicate entries while keeping playlist, queue and session references.
- Add Forget entry to remove a confirmed missing record and its playlist/queue references without deleting any audio file. Reject forgetting a file that exists or is only inaccessible.
- Restrict context-menu Left/Right to submenu navigation. Up/Down navigate menu items. Group Add missing total tracks, Add leading zeros, Remove leading zeros in that order.

# 0.98

- Close an empty Add to playlist submenu with Left Arrow and restore focus to its parent item.
- Select all visible artists with Ctrl/Cmd+A; tag editing, renaming, queueing and rating shortcuts operate on the selected artists' tracks. Rename previews check actual file availability and identify any unavailable file instead of rejecting a stale missing flag.
- Check known music files on startup using size and modification time, reread only changed metadata, refresh MP3 ratings and dynamic playlists, and preserve prior metadata while incomplete files are syncing. Modified-date rules use the filesystem modification time. New or moved files still require a rescan; changes synced after startup require a rescan or restart.
- Add General → Settings & storage → Cache → Clean unused. Remove orphan artwork and obsolete waveform versions; retain current caches, active waveform work, preferences, playlists, music and undo history. Use the active storage folder, including portable mode.
- Verify shared-file edits across two independent indexes, missing-file return, unreadable-file retry, cache retention and symlink safety, artist selection actions and empty submenu keyboard navigation.

# 0.91

- Unify Edit tags actions with shared 28px/13px text buttons: matching typography, centering, padding, corners, secondary borders and text-fit widths. Document required button variants and native checks.
- Add saved General → Library → Confirm multi-file tag edits, enabled by default; disabling it skips the second confirmation for manual and MusicBrainz batch saves.

# 0.90

- Add Settings → About with the native app version, build type, platform/processor, storage mode, data-folder action and runtime versions.
- Add local update preparation: verify a newer extracted release, confirm, copy portable persistent data through a verified staging folder, preserve system data mode, and keep the old app/data intact. Reject existing data destinations, corrupt releases, wrong native platform/architecture, unsafe paths and pending storage migrations.
- Add target-OS release commands, versioned artifact names, native/source release manifests and SHA-256 artifact checksums. Build Windows portable EXE/ZIP, macOS app ZIP and Linux AppImage/ZIP. Source release generation runs the verification gate and excludes user data/dependencies.
- Document signing/hosting requirements and the current local update workflow in RELEASING.md. Preserve the common Settings sizing and keyboard tab navigation with the new About tab.

# 0.89

- Complete maintenance audit with readable runtime formatting, repeatable lint/format/test commands and consolidated current documentation.
- Reuse natural-sort collators and evaluate dynamic playlist membership for the playing track directly. Keep folder-derived metadata consistent when remembering playback or converting dynamic playlists.
- Preserve playback position through tag saves; reject stale naming previews without trapping the Preview button; cap search expressions consistently at 2,000 characters.
- Fix rollback after overlapping failed settings writes and restore Last.fm switches after failed saves. Stop starting further scrobble requests during shutdown.
- Detach disposed audio listeners and discard late decoded buffers. Remove verified unused state/helpers and retired CSS selectors without changing saved preferences.
- Add nine regression checks, bringing the suite to 243. Audit native settings layouts, tag review, queue feedback and packaging; see MAINTENANCE.md for evidence and limitations.

# 0.88

- Tighten queue-add staggering to 300ms total and use stronger symmetric easing for softer starts and finishes, retaining 650ms movement and the subtle opacity-only glow.

# 0.87

- Pad both halves of existing track-number tags (7/9 → 07/09), preserving other metadata and audio. Place Edit tags above Rename files and folders across context menus.
- Use 650ms eased queue-add motion and a subtle opacity-only accent glow, with a 500ms total first-to-last stagger in each pane. Animate selected artist names alongside their selected tracks/albums; honor reduced motion and keep the artist pane free of horizontal scrollbars.
- Make standard Tags collapsible and persist both Tags and Track numbers disclosure states independently, including through restart.
- Extend the queue over the full window height while keeping the waveform at its original width. Preserve the existing overlay layout and queue-close alignment.

# 0.86

- Replace accumulating full-file tag/rating backups with metadata-only session snapshots. Integrate tag, rating and number edits into shared undo/redo; multi-track ratings form one action. Reject outside changes and preflight restores. Delete temporary snapshots and legacy tag-backups on normal exit after pending writes.
- Add Rename files and folders to track, album and artist menus: saved formulas, separate folder/file switches, a required preview, collision and stale-file checks, transactional rollback and session undo/redo. Preserve extensions, file contents, IDs, playlist references and browsing context.
- Add a saved General/Library switch for leading zeros when adding missing track totals.
- Fix tag-editor close hover, add the name/Add library close action and move submenu arrows beside labels. Document shared close/switch sizing, hover verification, session recovery and naming design.

# 0.85

- Combine manual tags, MusicBrainz metadata comparison and per-file track-number/total matching in Edit tags. Remove the duplicate Check track numbers context command, window and IPC writer.
- Keep local values visible, make proposals editable, require per-field opt-in, and preserve unchecked/unavailable tags. Multiple albums retain independent reviews; one confirmed Save uses the shared validated, backed-up batch writer.
- Reuse tags loaded by Edit tags, show disabled-dropdown/spinner loading state, distinguish empty results from lookup failures, and provide Retry. Discard stale replies after closing or changing albums.
- Preserve the main track pane scroll position and expanded album detail after applying tags or track numbers.
- Use 680px dialog width, 36px rows, 28px controls, right-aligned 30×17px switches, shared close icon, opaque sticky headers and independent content scrolling. Update design rules.

# 0.84

- Missing-tag queries support every existing search field, plus leading-zero and total-track checks against raw track-number tags. Search guide documents syntax and examples.
- Dynamic playlists can filter using Rules or Search expression; both main and renderer use the same cached parser. Expressions persist and invalid active syntax is rejected.
- Single focused artist now supplies all its tracks to the E tag-edit shortcut.
- Track, album and artist context menus can create playlists from selection or add to a regular playlist using a separate, viewport-aware submenu. Plus opens a compact destination picker; the shortcut is editable.
- All dialog close actions use the shared 18px SVG in a 28px button. Design rules updated. Removed the track-number dialog footer divider.
- Edit tags links to the existing MusicBrainz track-number review. Full metadata comparison remains a future design proposal.

# 0.83

- Queue extension silently falls back to overlay when the screen cannot fit it.
- Startup keeps the native window hidden until saved preferences, icons and UI handlers are initialized; fallback markup is hidden during loading.
- Track-number review uses Settings-sized switches on the right, 36px rows, 28px controls and aligned 13px text. Sticky column headers have an opaque theme-aware background and their own layer.
- Added DESIGN.md and AGENTS.md to keep future dialogs consistent.

# 0.82

- Add editable Shift+Enter context-menu shortcut; preserve native Context Menu / Shift+F10. Arrow keys, Enter/Space and Escape remain inside the menu; toggles stay open and commands close.
- Wrap artist navigation from last to first and first to last.
- Remove queue animation’s animated blur/brightness filters and per-row forced layout reads; use transform-only Web Animations with static subtle glow, safe restart and reduced-motion support.
- Add saved leading-zero option for both track numbers and totals in MusicBrainz lookup, with live preview. Add the lookup to track context menus, including multi-track selections.
- Centralize context labels: ellipses for additional dialog input; none for direct commands or checkmarks.

# 0.81

- Vertically center preference tab text against Settings; reduce stable dialog height to 80% of the viewport.
- Add album context action Check track numbers… for MP3s, with MusicBrainz edition selection, per-file matching and review before Apply changes.
- Match unique titles conservatively; leave ambiguous/unmatched titles for manual release-track selection. Preserve existing leading-zero formatting and use full release per-disc totals for partial local albums.
- Write only track-number tags with existing file-integrity checks and backups; refresh only saved files.
- Keep MusicBrainz requests read-only, serialized at least 1.1 seconds apart, bounded by timeout and cached in memory. No API key required.

# 0.80

- Align Last.fm and Shortcuts headings and first rows to the other preferences tabs.
- Add a Keyboard section heading above global playback keys; use shared 13 px labels and 36 px shortcut rows.
- Remove legacy shortcut row borders and Last.fm heading minimum height.
- Match Last.fm connection buttons to standard 28 px settings actions with text-fit width and regular-weight 13 px text.

# 0.79

- Keep Settings at a stable viewport-relative height across all tabs, with fixed header and scrolling content.
- Correct global playback switch accent; unify reset button styling and place Navigation guide on the same row at the right.
- Rename queue count, column headings and default-order shortcut labels; remove audio-output help.
- Reset regular playlists to playlist order and libraries/dynamic playlists to the configured default order.
- Edit every selected artist’s MP3 tracks through the tag shortcut, matching context-menu behavior.
- Keep album information, seekbar and column option menus open while toggling settings; unify seekbar height-lock checkmarks.
- Ease queue-add feedback over 850 ms with a subtle brightness/accent glow; respect reduced-motion preferences.

# 0.78

- Refine preferences to 680 px width, 20 px content padding, 13 px body/control text, 18 px title, 36 px rows and 28 px controls.
- Unify label/control alignment, 245 px dropdowns, 72 px numeric inputs and 30×17 px switches; keep one divider between groups.
- Restore General order: On opening, Play queue, Library, Settings & storage. Retain artist grouping/default sort controls within Library.
- Replace inline help disclosures with one reusable nonmodal popover using a centralized setting-ID map, 24 px help triggers and 15 px question-mark icons.
- Add accessible Enter/Space activation, viewport-aware placement, single-popover lifecycle and Escape/close focus restoration.
- Move complete search and navigation documentation into a separate modal guide with independent scrolling and keyboard focus containment.
- Fit shorter tabs to their content, keep headers fixed and scroll longer tabs; preserve existing preferences and behavior.

# 0.77

- Add Artist names: Parent folder / Artist / Album artist, with Album artist the new-install default and older folder behavior preserved.
- Add default sort order (Year on new installs; Folder order retained for older setups).
- Enable album-list sorting and create whole-collection queues in the displayed album order without restricting them to selected artists.
- Add editable Option/Alt + Left/Right seek shortcuts and configurable 1–60 second seek step (default 5).
- Show tag editor immediately with loading state; read up to four files concurrently and skip artwork decoding in the metadata parser.
- Compile and cache dynamic-rule predicates without caching results, so ratings/tag edits and moving date ranges stay live.
- Compute album sort values once per album instead of inside each comparison.
- Require real pointer movement for cover hover; do not let programmatic focus set cover selection. Add compact album-art hover outline.

# 0.76

- Redesign all five settings tabs with aligned 28 px controls and 34–36 px rows.
- Keep the header fixed and scroll the content, with unified typography and subtle group dividers.
- Reorder General into opening, queue, library and storage; put Audio output before playback.
- Move detailed search, navigation, storage and playback explanations into expandable help links.
- Group editable shortcuts by task; make ratings expandable and keep them open during edits.
- Add live color/slider values and expandable Last.fm credentials; retain existing settings and connections.

# 0.75

- Make supplied design/browsing/pane/column preferences the defaults for new setups and appearance reset, without overwriting existing saved preferences.
- Centralize design defaults for renderer and backend; freeze historical column migration patterns instead of deriving them from the new design.
- Add stable Random sort and Reshuffle in track/cover views.
- Enable whole-album cover sorting with album-length and average-track-rating values.
- Clone normalized defaults so one collection cannot mutate defaults used by the next.

# 0.74

- Default queue display to 100-song pages; add General Settings display-count control.
- Remove queue footer and oversized scroll padding.
- Extract tag, playlist-rule, Last.fm form controllers and versioned optimistic settings writes.
- Guard disposed forms against late replies and clear the dynamic-playlist refresh timer.
- Close out the scoped code maintenance pass; retain native verification requirements.

# 0.73

- Tint multi-selected album-list artwork consistently with cover view.
- E edits tags for every track inside selected albums, including collapsed albums.
- Add editable Shift+C to expand/collapse all albums in the current list.
- Resume maintenance: extract shared dialog lifecycle/focus and settings-tab controllers.

# 0.72

- Move collapsed album navigation outlines onto artwork; preserve pane focus and scroll.
- Select multiple collapsed albums with Shift + arrows and expand/collapse the selection.
- Remove cover check badges; tint multiple selected covers subtly in the accent color.
- Import file-browser audio drops into regular playlists without copying files or scanning sibling folders.
- Pause the maintenance pass after 0.71; settings/dialog coordination remains pending.

# Historical release notes

This archive includes superseded behavior and setup advice. Use README.md for the current release.

# Localtone — first desktop prototype

A local music player with a compact, dark interface, named folder libraries, tag search, sortable track lists, playlists, a play queue, shuffle, repeat, seeking, volume, and embedded artwork.

## Update from the first version

1. Close Localtone completely.
2. Extract this updated ZIP into a new folder.
3. Open Terminal, type `cd `, drag the new `localtone` folder into Terminal, and press Return.
4. Run `npm install`, then `npm start`.

If updating from 0.20 or earlier, your existing collection is copied into `localtone/Localtone-data` automatically on first launch. The previous copy is left intact. From 0.21 onward, **copy your existing `Localtone-data` folder into the new program folder before starting an update**. This keeps libraries, playlists, preferences, caches, and backups together.

### Changes in 0.26.0

- Settings now has General, Appearance, Connections, and Shortcuts tabs. General contains browsing and storage; Appearance contains interface and waveform preferences; Connections contains Last.fm. The active tab stays selected when reopening Settings during the session.
- Settings uses a stable-size window with an independently scrolling panel. Tabs support Left/Right, Home, and End, with proper tab/panel labels and keyboard focus.
- All settings dialogs share 12px typography, 30px controls, aligned label/control rows, 8px row spacing, restrained section headings, and the same field/button surfaces. Binary settings use checkboxes; multiple-choice preferences use dropdowns.
- Playlist settings and dynamic rules use the same visual system. The editor scrolls independently of its Save/Cancel buttons, adapts to narrow windows, and supports multi-value date rules without squeezing controls.
- Naming and MP3 tag dialogs follow the same typography, controls, spacing, and focus treatment. Focus outlines are removed from dialog fields and selectors; a subtle background change retains a keyboard focus cue.
- Last.fm actions are grouped into credentials and connection controls. Settings continue to save immediately; playlist changes still use Save.

### Changes in 0.25.0

- Search has no highlighted focus outline. Artist search and the right-pane toolbar both leave a fixed 10px gap before their independently scrolling content. Tracks/albums no longer scroll beneath the toolbar.
- Rating stars are 12px in track lists and below the playing cover, matching the normal text size more closely.
- Add to play queue inserts all selected songs immediately after the playing song, preserving selection order and each added song's collection origin. Dropping new library tracks into the queue background also inserts them next; dropping on a specific queue row follows that position.
- Settings → Portable chooses storage beside the program or in the normal per-user app-data folder. Portable remains enabled by default for existing installations. Changing it takes effect on the next launch: current collection/settings, playlists, listening history, Last.fm credentials, tag backups, and caches are copied to the selected location. Original data and any previous destination are preserved. Close Localtone fully before restarting to apply it. Cancelling the change before restart keeps the current location.
- Portable storage mode is remembered in `Localtone-data/storage-mode.json`; preserve the full `Localtone-data` folder during updates, even if Portable is switched off. Music files stay in their existing locations. Last.fm credentials remain protected by the operating system.
- Removed the visible Sort prefix; the dropdown retains its accessible label. Selecting an artist no longer adds an artist-name heading above the albums.

### Changes in 0.24.0

- Playback controls are beneath the playing album cover again: Shuffle left, Previous/Play/Next centered, Repeat right. Queue remains beside Settings in the main pane.
- Right-click the seekbar for a non-modal menu: Waveform/Line, Bars/Filled/Outline, Compact/Tall, and Normalize. The options use the existing saved settings and remain available in Settings too. Right-click does not change the playback position. Keyboard menu access works with Context Menu or Shift+F10 while the seekbar is focused.
- The collection title and summary are hidden in the main pane. Hover over a library or playlist in the sidebar to see its full track count and total minutes, unaffected by artist selection or search.
- Artist search, Albums/Covers/Tracks, sorting, volume, Queue, and Settings now occupy the top row. Sorting is directly beside the tabs; utilities align at the far right. Control groups share a 30px outer height. Compact spacing adapts to narrow panes.
- Track numbers have at least two digits: 01, 02, …, 99, 100. This applies to Tracks, Playlists, and expanded Albums.
- The waveform keeps equal 12px padding above/below and no separator line; its dock no longer reserves space for transport controls.

### Changes in 0.23.0

- Column dividers now use measured pixel widths rather than CSS formulas. Drag a divider between two headings to resize both adjacent columns; the table retains its full width. Fixed columns remain draggable: Fixed means their width is retained when the window changes size. Flexible columns share the remaining space. Dragging a flexible column also works when it is the only flexible column. The final outside edge has no divider; resize the last column with the divider immediately to its left.
- Right-click a specific column heading to choose Left, Center, or Right alignment for that column. Alignments are saved independently for Tracks, Playlists, and Albums. The header menu also contains Hide column names; Settings → Show column headings restores them. Hidden names retain the column layout and hide all resize handles.
- Transport controls are now above the waveform in the right workspace: Shuffle at the left edge, Previous/Play/Next centered, Repeat at the right edge. Queue is beside Settings at the top right.
- The waveform has equal 12px spacing above and below, and no separator border above the player area.
- Text uses three sizes throughout: Small (11px), Normal (12px), and Large (20px). Playing time is Normal; the rating/time row wraps when the sidebar is too narrow.
- Manual Next, Previous, and Random Next reveal and select the playing track in its original playlist/library. Tracks view remains Tracks; Albums expands the playing album. Covers switches to Albums so the track can be highlighted. Search is cleared and the playing artist is selected to make the track visible. Automatic song-end progression continues without forcing navigation.

### Changes in 0.22.0

- Starting a track or album queues the full selected library, playlist, or All music collection. Artist selection and search filter browsing only. Playback starts at the chosen song; enabling shuffle puts it first and makes all other queue entries available next, including tracks originally before it. Browsing does not replace an existing queue.
- Settings → Show column headings hides headers and their resize handles. Column widths remain intact, and this preference survives restart. With headings visible, resize dividers appear only when hovering over a heading.
- The default preset now uses 42px for Number, 100px for Rating, and 80px for Duration; Title fills the remaining width. This fits track numbers through 999 and durations through 99:59:59. Tables account for vertical scrollbar space and fit inside the content pane. In unusually narrow panes, fixed columns temporarily shrink together to keep the table within the pane; saved widths stay unchanged. Untouched 0.21 presets migrate, while customized widths stay as saved.
- Playing information below the cover shows the title and artist only. The album artwork still jumps to the playing song in its original collection.
- Waveform colors are more subdued, especially in Outline style.

### Changes in 0.21.0

- The left sidebar now holds the playing cover, stars, elapsed/total time, title, artist/album links, and playback controls. The waveform spans the workspace to its right, including the artist pane.
- Default columns in Tracks, Playlists, and Albums are **# / Title / Rating / Duration**. Number (52px), Rating (100px), and Duration (72px) are fixed; Title fills the remaining width. Untouched old presets migrate; customized layouts stay intact.
- Right-click a column heading: toggle visibility or switch a visible column between Fixed and Flexible. Drag the narrow 6px divider to resize; drag headings to reorder. At least one visible column stays flexible to fill the pane. Layouts remain separate for Tracks, Playlists, and Albums.
- Portable storage is enabled by default. See below for folder locations and updates.

### Portable storage and builds

All app-managed persistent data is under `Localtone-data`: settings, library index, playlists, listening history, Last.fm credentials, cover/waveform caches, MP3 backups, and Electron session/log files. MP3 tags and ratings are still written to the music files themselves.

| How you run it | Data location |
| --- | --- |
| Source (`npm start`), all systems | Inside the `localtone` project folder |
| Windows extracted build | Beside `Localtone.exe` |
| macOS extracted build | Beside `Localtone.app`, outside its signed bundle |
| Linux AppImage | Beside the AppImage, outside its temporary mount |

Use a writable folder. On Mac, extract/move the app out of a disk image before launching; on Windows, use a folder you can write to. Keep the complete extracted Windows app folder, not only its EXE. For updates, close Localtone and preserve or copy `Localtone-data` beside the new program. Never replace it with an empty folder.

Moving the app and data keeps settings together, but music locations are currently absolute paths. Changed drive letters or paths require library re-import; playlist references are not automatically remapped. Last.fm credentials use operating-system encryption and may require reconnecting when moving between computers or operating systems.

To build on the target operating system, run `npm install` followed by `npm run dist`. Packaging produces a ZIP on Windows/macOS and an AppImage on Linux. These build targets are configured; this source download does not contain tested executable releases.

### Changes in 0.20.0

- Albums / Covers / Tracks is remembered globally. Switching libraries, playlists, or All music preserves the current view, and reopening the app restores it.
- Search Enter switches to Tracks and remembers it; player album navigation switches to Albums and remembers it. Artist selection still follows the separate opening-artist preference.
- Removed Start view from Settings, since the current view is saved automatically. Existing installations migrate from their previous start/cover preferences.

### Changes in 0.19.0

- Cmd/Ctrl+Shift+Right chooses a different track from the full current library/playlist/All music collection, ignoring artist selection and search. Dynamic playlist rules still define membership. The existing queue is retained: an upcoming occurrence of the chosen track moves next, or a new occurrence is inserted next. Artist browsing does not alter the queue.
- Visible track columns fill 100% of the pane in Tracks, Playlists, and expanded Albums. Saved widths are interpreted as relative proportions. Drag-resizing adjusts those proportions; hiding/reordering columns retains full-width layout. The final rating column aligns right with the sorting area, including the overlay-scrollbar inset. Very narrow columns truncate text and compress star spacing to remain within the pane.

### Changes in 0.18.0

- Sorting is always visible, disabled and dimmed outside Tracks. The select is 132px wide, enough for Playlist order and its dropdown arrow. Compact toolbar spacing adapts to narrow content panes.
- Controls now share a local SVG outline icon family with 16px symbols and consistent stroke weight, including transport, settings, search, sidebar folders/playlists, rating stars, close/add buttons, back navigation, and column checkmarks. Dynamic playlists have a distinct refresh/list icon. No icon font or network fetch is used.
- Album artwork/name navigation returns to the playlist, library, or All music view where the playing queue item originated, then expands its album and selects the track. Queue insertion, reordering, random next, and shuffle preserve each occurrence's origin, including duplicate songs from different playlists. Browsing elsewhere does not change the playing origin. If the source playlist is gone or no longer contains the track, the source library is the fallback.

### Changes in 0.17.0

- Rating hover/focus previews change instantly, without transitions or animations.
- Click the playing album artwork or album name to open its library in Albums view, expand the album, select the playing track, and scroll to it. This works regardless of the saved cover/list preference or current search.
- Removed Add to playlist entries from track context menus. Drag-and-drop remains available.
- Empty artist and album/cover messages share matching margins, padding, and line height.
- Backspace or Delete removes selected visible tracks from a manual playlist, including multi-selection. It does not delete files or change the playback queue, and is inactive in text fields, dialogs, context menus, libraries, and dynamic playlists.

### Changes in 0.16.0

- The artist pane is always present for libraries and playlists. Removed its playlist-settings checkbox; old saved browse flags are ignored by the interface. All three main tabs are enabled everywhere.
- Search sits at the top of the artist pane and follows its resized width. It retains collection-wide search behavior and Cmd/Ctrl+F. The adjacent content pane has tabs at its left edge and track sorting at the far right, with matching 30px toolbar heights.
- Opening an artist automatically reveals its name by scrolling only the artist list. Ordinary redraws preserve manual artist-list scroll position. Random/First/Last listened to/None apply to every collection.
- Removed mute. Volume stays beside Settings in the upper-right; the slider can still be set to zero.

### Changes in 0.15.0

- Albums / Covers / Tracks always stay visible. All three are greyed out and disabled for playlists without artist browsing.
- Search is capped at 280px and aligned to the main toolbar's right edge; its reserved slot stays stable across views.
- Removed artist sorting controls. Artist folders now appear alphabetically, and First opens the first alphabetical artist.
- Settings moves from the sidebar to the top-right of the main pane. Volume and mute move from the player footer to immediately left of Settings. Their existing behavior and saved volume are preserved.

### Changes in 0.14.0

- A fixed shared toolbar sits below the collection title: tabs, a reserved sorting slot, then search. It spans the main area independently of the artist pane and scrollbars. Search stays in the same position when switching Albums/Covers/Tracks or opening simple playlists. Inactive tabs and sorting disappear but their slots stay reserved. Artist sorting stays within the artist pane.
- Artist on opening now offers First in addition to Random / None / Last listened to. First follows the current artist list sorting order. The same preference applies to playlists with artist browsing; simple playlists still show all their tracks.
- Last listened to is remembered for each playlist containing the played track, as well as each library. Missing or removed listening-history entries fall back to a random artist.
- Hovering or focusing a rating previews exactly that many filled stars in a muted accent. Leaving restores the saved rating. Clicking commits the usual accent-colored rating. Hovering no longer highlights a button-shaped background.

### Changes in 0.13.0

- Dynamic playlists have a distinct ⟳ sidebar icon, tooltip, and accessible label. Manual playlists retain ♫.
- Collection totals always describe the full library or playlist. Search and artist selection do not change them; changes to actual membership still do.
- Playlists without artist browsing hide the Albums / Covers / Tracks tabs entirely. Their sorting controls sit beneath search, reclaiming the former tabs row. Library-style views preserve the shared tabs/sorting row.
- Playlist settings use the shared 30px controls, tighter checkbox spacing, aligned fields without inherited input margins, compact actions, and consistent borders. Relative date amounts/units share a row; date ranges remain readable.

### Changes in 0.12.0

- Settings → Artist on opening: Random (default), None (show all), or Last listened to. Library and All music views select an artist before rendering the track/album content. Click the selected artist again to show everything. Last listened to is remembered per library and across restarts; if unavailable, a random artist is chosen. This reduces rendered content and sorts only the selected artist's tracks; the collection index still loads into memory.
- New playlists open one dialog for name, dynamic rules, and the optional Artist pane and album / cover tabs checkbox. Enable browsing for a large playlist to use Albums / Covers / Tracks and the artist pane; every view stays within that playlist's membership. Existing and small playlists retain simple track browsing by default. Right-click → Playlist settings… changes these options later.
- All rule fields offer Is empty / Is not empty. Rating → Is empty selects unrated tracks. After a rescan, missing title/artist/album tags are detected even when the browser displays a filename or Unknown artist fallback.
- Date added and Date modified filters support In the last / Older than with days or weeks, On or after / On or before, and Between dates. Date ranges include both calendar dates in the computer's local timezone. Relative windows count elapsed 24-hour days and exclude future dates; an open dynamic playlist refreshes at least once a minute while visible.
- Date added records when Localtone first imports a new track, starting with this release. Existing tracks have an unknown added date; it cannot be reconstructed reliably. Date modified comes from the file's modification timestamp, including MP3 tag/rating writes. Rescan to detect external file edits or new files. Added dates survive rescans and tag edits at the same path; removing/reimporting or moving a file creates a new entry.
- Removed Write existing ratings to MP3s from Settings. MP3 rating changes continue to write into the file. Localtone still maintains its collection index, preferences, playlists, and ratings for other formats. Existing legacy rating migration data is preserved.

### Changes in 0.11.0

- Waveform seeking: Settings → Player chooses Waveform or Line, Bars/Filled/Outline, Compact/Tall, and normalization. Played audio uses the active accent color. Click or drag anywhere on the waveform to seek. The waveform analyzes local audio in the background and is cached; the line remains usable while loading or when a file cannot be analyzed. This first version shows a combined stereo amplitude envelope, not separate channels or a frequency spectrum.
- The main tabs are Albums / Covers / Tracks. Albums always shows expandable album rows; Covers shows the responsive cover grid. The duplicate right-side view controls are removed.
- Right-click a playlist → Playlist settings… → enable Dynamic playlist. Choose a source library (or all libraries), Match all/any, and rules for rating, year, duration, title, artist, album artist, album, genre, or format. For favorites, use Rating → at least → 4. Rules update as ratings, tags, and scanned library contents change. Folder changes require a rescan. Disabling dynamics keeps the current matches as a manual playlist. Dynamic playlists use sorting rather than manual additions/reordering.
- Settings and playlist-rule controls use compact 30px heights and consistent neutral styling across accent schemes.

Run `npm install` in the new folder before starting: this update adds a local audio decoder, downloaded once during installation. Waveforms require no online service. Analysis supports files up to six hours long, with a 90-second analysis timeout and normal line seeking as fallback. Decoder binaries are platform-specific; install dependencies on the computer where you run or build the app.

### Changes in 0.10.0

- Cover grids use equally sized flexible columns to fill the album pane, with consistent 14px gaps. Small/Medium/Large determine the minimum cover size and resulting density. Covers stay square while resizing the app or artist pane.
- Right-click a track, album heading/cover, or artist folder and choose Open folder. Tracks open their immediate containing folder (including a disc folder); albums open the album's root folder; artists open the artist folder. Folder requests resolve from registered tracks in the main process rather than accepting arbitrary renderer paths.
- Column order, width, and visibility are stored separately for Tracks, Playlists, and Albums. Existing global column settings seed all three layouts once. All playlists share the Playlists layout; all album tables share the Albums layout.
- Settings → Albums on opening chooses Expanded or Collapsed. Manual toggles work within the current album view; entering the Albums tab or choosing a different artist applies the saved default again. Opening a cover always shows that album's tracks.
- Removed shortcut text from the search bar.
- Album controls account for vertical overflow: normal scrollbars reduce the content width naturally; overlay scrollbars receive an extra 12px control inset while content overflows.

### Fix in 0.9.1

Authorization tokens are now treated as opaque strings, without the incorrect requirement that they be 32 hexadecimal characters. Tokens are preserved unchanged in the browser URL and session signature. Missing or malformed response values are still rejected without exposing credentials. Last.fm requests include an identifiable Localtone User-Agent, and Last.fm settings errors no longer display Electron's internal IPC prefix.

After updating, keep your saved API details. Click Connect again, authorize in your browser, and click Finish connection. This fix is covered by simulated nonhex and variable-length token tests; live authorization still needs confirmation on your Mac.

### Changes in 0.9.0

- Search now reduces the artist-folder list to folders containing matching tracks. Selecting a folder filters the matching results; if the selected folder has no results, selection is cleared.
- Albums group by the first album folder below the artist folder (nested disc folders stay together). Album and track ordering follows folder paths and filenames using natural numeric order: 2 before 10. Year, disc, and track-number tags no longer determine this order. Tracks defaults to Folder order; choosing an artist restores that order. Other track sorts remain available explicitly.
- Last.fm is available in Settings. Localtone sends Now Playing and eligible scrobbles using actual file tags, never folder or filename guesses. Tracks with no artist/title tags are skipped.

### Connect Last.fm

1. Open Settings → Last.fm → Get API credentials (https://www.last.fm/api/account/create). Register your own application, or use your existing application's API key and shared secret.
2. Paste the key and shared secret into Settings and click Save API details.
3. Click Connect. Your normal browser opens Last.fm; sign in there and approve access. Localtone never asks for your account password.
4. Return to Settings and click Finish connection. Scrobbling turns on. The checkbox can pause sharing without disconnecting.

The track must exceed 30 seconds and you must actually listen to half its duration or four minutes, whichever is shorter. Pauses, buffering, and seeks do not count as played time. Repeats count as new plays. Enabling scrobbling mid-track starts a fresh listening count.

Failed scrobbles are saved for later and retried in order with backoff; the queue survives restarts. Now Playing failures are not retried. A revoked session prompts reconnection. Disconnecting or replacing API credentials clears queued scrobbles; switching account during authorization also clears them to avoid sending one account's listening history to another.

API credentials, session key, and the pending queue are saved in a separate encrypted `lastfm.enc` file using Electron's OS-backed safeStorage. On Linux a supported system keyring is required; Localtone refuses plaintext storage. Credentials are not stored in collection.json or returned in renderer status. Source music files and absolute paths are never submitted to Last.fm. Scrobble requests contain artist/title, available album metadata, duration, and the playback start timestamp.

Native Last.fm login, OS keychain access, and actual account submissions have not been tested here. API behavior is tested using simulated responses. Network retries reuse the original playback timestamp; delivery is not an exactly-once guarantee if a server accepts a request but its response is lost.

API references: https://www.last.fm/api/desktopauth and https://www.last.fm/api/scrobbling

### Changes in 0.8.0

- Library browsing now keeps artist folders on the left and only Albums / Tracks tabs on the right. Select a folder to filter either view; click it again to show all folders. Playlists retain their full-width track view.
- Artist list labels come from the first folder below each library root, not MP3 artist tags: `Music/nine inch nails/Album/song.mp3` belongs to `nine inch nails`. A separate `nine inch nails b` folder stays separate even with identical tags. Files directly inside the library root appear under the root folder name. Album groups remain separated between artist folders. Track metadata remains unchanged.
- Existing collections gain folder browsing automatically on load; no rescan is required. Search includes folder names, and the folder pane remains available while searching. Selecting a folder scopes search results to that folder.
- Album list / Covers is remembered independently of the main tab and persists across restarts. Cover size remains in Settings.
- Drag the divider beside the leftmost sidebar or artist list to resize it. Both widths persist. Focus a divider and use Left/Right to adjust it with the keyboard.
- Right-click a library and choose Delete library to remove it from Localtone, playlists, and the queue. A confirmation explains that music files stay on disk. Playback stops if the playing track belongs to the removed library.
- Add to play queue no longer shows a confirmation popup.

### Changes in 0.7.0

- Right-click tracks, playlists, libraries, or column headers for a compact nonmodal popup. Menus close on outside click or Escape and support Up/Down, Home/End, and Enter. Column headers now own column visibility; it is no longer in Settings.
- Choosing an artist activates Albums; clicking Artists returns to the artist list. Artist and track sorting use matching Sort dropdowns and ascending/descending arrow buttons.
- Search filters as you type. Enter immediately opens Tracks and focuses the first result. Cmd/Ctrl+A selects every filtered track in Tracks, or tracks in currently expanded album tables. Text fields retain their normal Select All behavior. Drag any selected track to move the selection together.
- Tracks uses one continuous list with no pages or pagination count. Hidden track tables are not rebuilt while browsing artists or albums.
- Track drops onto playlists show a + highlight and copy cursor; playlist rearrangement shows an insertion line. Drops no longer show Saving or Ready notifications. Errors still appear.
- Aligned logo, collection title/info, and search heights, with slightly more space before the tabs. Cover size is only in Settings. Album rating controls are removed; existing stored album-rating values are retained but unused by the interface.

### Changes in 0.6.0

- Click a track, then Shift-click another to select a range. Cmd-click on Mac or Ctrl-click on Windows/Linux toggles individual tracks. Drag any selected track to carry the selected group to a playlist or queue. Selection follows the displayed track order. Within an album table, ranges apply to that album.
- Right-click a library in the sidebar to rename it or rescan its folder. Right-click a playlist to rename or delete it. Playlists reference library tracks and have no separate folder to rescan. These actions no longer occupy the main view.
- Drag playlists up or down in the sidebar; their order persists across restarts.
- Search sits at the top right beside the collection title. Artist Sort, album list/cover controls, and track Sort share the tab row, aligned to the right. Header spacing is reduced.
- Selected tracks can also be added to a playlist/queue or removed from a playlist together using their right-click menu. Drag groups within a playlist in Playlist order, with search cleared, to move them before a row or to the blank end row.
- Last.fm remains deferred.

### Changes in 0.5.0

- Tighter spacing below library/playlist titles. Queue colors now follow the same neutral dark surfaces and selected accent. Playlist insertion lines match the queue; drop into the blank row at the bottom to move to the end.
- Drag column headers to reorder them. Drag the right edge of a header to resize it. **Settings → Track columns** controls visibility (Title stays visible). Order, width, and visibility persist and apply to Tracks and expanded album tables; wide tables scroll horizontally.
- Main navigation is now **Artists / Albums / Tracks**. Within albums or an artist page, use **Album list / Covers**. The cover-size control reserves its space in list view so the toggle stays put.
- Album headings show the sum of track durations. Album stars are separate from track stars and are stored in Localtone; rating an album does not rewrite individual MP3 ratings. Album identity uses album artist + album name.
- Artist sorting supports Name A–Z/Z–A and total track duration, longest/shortest first. The choice persists.
- **Cmd/Ctrl + Left** goes to the previous track; **Cmd/Ctrl + Right** goes to the next. **Cmd/Ctrl + Shift + Right** chooses a random different track from the queue for next playback. If no queue exists it starts a random track from the current view. Navigation shortcuts stay inactive in text fields and dialogs.
- Removed album expansion chevrons and track ⋯ buttons. Right-click (or Shift+F10 on a focused row) opens track actions. The context menu no longer contains stars, Clear rating, or Play now. Rate via visible stars/keyboard; clear a track rating with Cmd/Ctrl+0; double-click or press Enter to play.

Last.fm is not connected in this release. Its desktop API supports browser authorization using an application API key/secret and an approved session. A future scrobbler needs secure session storage, listened-time tracking that excludes seeks/pauses, and an offline retry queue. Do not send account passwords to the developer or put them in the source.

### Changes in 0.4.0

- **MP3 ratings now write to the file** on every star click or rating shortcut. Stored as ID3 POPM (Windows Media Player 9 Series, values 1/64/128/196/255) and TXXX:RATING (1–5). Clear stores 0 for unrated. Each change keeps a byte-for-byte backup and verifies the audio payload is unchanged. Other audio formats still use Localtone-only ratings.
- Existing file ratings load during import or rescan. To write ratings assigned in older Localtone versions, open **Settings → Write existing ratings to MP3s**. This handles old database-only MP3 ratings without silently rewriting your collection at startup. Backups can be opened via **Edit tags → Show backups**.
- Drag a **track row, album heading, album cover, or artist name** onto a playlist in the sidebar. Album drops add album tracks in disc/track order; artist drops add that artist's tracks within the current library/search. Existing playlist entries are not duplicated.
- Drag queue items onto another queue item to insert before it, or onto blank space below the queue to move to the end. The playing occurrence is preserved even when duplicate songs are queued. Library tracks, albums, and artists can also be dropped into the queue or onto the queue button in the player to append.
- An artist page has explicit **Album list / Covers** controls. Covers retain the selected artist, support Small/Medium/Large sizes, and open the album's tracks when clicked.
- Removed the large Play button beneath library/playlist headings. Play from a track, album, or the player controls.
- Seeking now has a 20px pointer target, explicit click/drag positioning, duration fallback, and byte-range audio responses (206, Content-Range, Accept-Ranges).
- Unified sidebar rows at 32px, compact controls at 30px, consistent borders/radii, neutral dark surfaces, and drag target highlights.

Compatibility note: file tag structures are tested, but opening the results in a real foobar2000 installation has not been verified here. Existing tag normalization limitations from the MP3 editor still apply.

### Changes in 0.3.0

- Whole-star track ratings, 1–5, with unrated as the default. Click stars in track rows, expanded albums, the player, or a track's menu. Ratings are stored in Localtone's collection, not in MP3 tags, and survive normal rescans and restarts. Moving a file to a different path creates a new track identity and does not transfer its rating.
- **Cmd + 1–5** on Mac / **Ctrl + 1–5** on Windows and Linux rates the selected track, or the playing track if nothing is selected. **Cmd/Ctrl + 0** clears a rating. Rating shortcuts do not operate while editing text or while a dialog is open.
- Click a row once to select it; double-click or press Enter to play. This now applies to expanded album tracks as well as the main track table. Selection is highlighted.
- **Settings** in the sidebar: Sage, Slate grey, Steel blue, Lavender, or Amber accents, always on a dark background; Small/Medium/Large covers; default start view; shortcut reference.
- **Cmd/Ctrl + F** focuses search. The previous Cmd/Ctrl + K shortcut is removed.
- Click the **artist** or **album** in the player bar to open its page in the track's library. This clears search so that the destination is visible.
- **Right-click** a track in the table, album list, or queue to open its track menu. Shift+F10 works on a focused track row.
- **Duration** replaces the Time column; ratings are sortable in Tracks view.
- Cover size can also be chosen directly from the Covers tab.
- Shuffle is in the bottom player beside Repeat. Volume, shuffle, repeat, theme, cover size, and start-view preferences are remembered. The queue itself still resets at restart.
- Turning shuffle off restores the remaining queued tracks to their source order while preserving the played history and current track.

### Changes in 0.2.0

- **Artists**: names only. Select a name to see expandable/collapsible albums.
- **Albums**: expandable album list for the current library or selected artist.
- **Covers**: artwork-only grid; hover for names, click a cover to open the album. Albums without embedded artwork show a placeholder.
- **Tracks**: the existing sortable list. Playlists use this view.
- Use **Back** to leave an album or artist. Clicking **Artists** returns to all artists. Search stays within the selected library and filters the displayed collection.
- Artist lists include track artists and album artists. Compilations can be found under individual performers or their album artist; selecting one performer shows the relevant complete compilation within the current search results. Albums are grouped by album artist and album title, with discs and tracks in numeric order.
- **MP3 tag editor**: open a track's **⋯ → Edit tags…**. Edit title, artist, album artist, album, year, genre, track number, and disc number, then click **Save tags**. One file at a time. Other formats remain read-only.
- Saves write the original MP3 and refresh its library. The current track pauses and resets if edited while playing; press Play to restart.
- Every write creates an exact-byte backup, verifies unchanged audio bytes, checks for stale edits, and rolls back if collection saving fails. **Show backups** opens the backup folder. Backups accumulate until you remove them yourself.
- Saved tags use ID3v2.3; supported tags/artwork are carried over. Legacy ID3v1 is replaced by the edited ID3v2 fields. Unusual or unsupported tag frames may not survive normalization; retain the original backup. Artwork editing and batch edits are not implemented.
- To restore a backup: quit Localtone, copy the `.bak` file to a safe folder, rename that copy to the original `.mp3` filename, replace the edited file with it, then reopen Localtone and rescan the library.

### Changes in 0.1.1

- Removed slogans, the large banner, and decorative artwork.
- Smaller sidebar, controls, track rows (38px), and player (72px).
- Explicit Add/Return submission for naming libraries and playlists; Cancel no longer acts as the default submit button.
- New libraries are selected after import. Busy controls are temporarily disabled, and errors allow retry.

## Run it

Install a current Node.js LTS release, then open a terminal in this folder:

```sh
npm install
npm start
```

The first installation downloads dependencies. Listening and library scanning then work offline. No account, music upload, telemetry, or streaming service is used.

Click **Add a music folder**, name the library, and choose a folder. Each library currently corresponds to one folder and its subfolders. Files are indexed in place; original files are not modified. MP3, FLAC, WAV, OGG, M4A, AAC, Opus, and AIFF extensions are indexed. Actual playback depends on Chromium's codec/container support; indexing a file does not guarantee playback.

Double-click a track or focus its row and press Enter to play. Use **⋯** to add tracks to playlists or the play queue. Drag rows to reorder a playlist with **Playlist order** selected and search cleared; Move up/down actions also work. Playlists do not allow duplicate tracks. Search matches track title, artist, album, year, genre, and format. Use **Rescan folder** to pick up changes; this version does not monitor folders automatically.

Keyboard shortcuts: **Space** toggles playback outside controls; **Ctrl/Cmd F** focuses search; **Ctrl/Cmd 1–5** rates the selected or playing track; **Ctrl/Cmd 0** clears its rating.

## Build desktop packages

```sh
npm run dist
```

Build on each target operating system for the most straightforward results: ZIP on macOS and Windows, AppImage on Linux. Distribution signing/notarization is not configured. This version uses Electron 44 and requires macOS 13 (Ventura) or later on Mac. Older macOS versions, including Catalina and Monterey, cannot run it. Windows and Linux require 64-bit supported operating systems.

## Current scope and limitations

This is an early source-code prototype, not a tested foobar2000 replacement or a ready-to-install signed release. Windows/macOS/Linux packaging is configured but must be built and tested on those systems.

- Metadata extraction runs in a worker; all matching tracks are shown without pagination.
- Collection metadata and playlists persist in `collection.json` in the portable `Localtone-data` folder. Audio remains in the source folder. Artwork is cached separately. A failed scan or invalid collection file is not silently accepted.
- Persistence currently uses an atomic JSON file replacement. Back up `collection.json` for important playlists. The queue resets on restart; volume, shuffle, repeat, and appearance settings persist.
- Very large collections need a SQLite index, database-backed search, incremental queries, and performance benchmarking. The current implementation holds the collection in memory.
- No gapless/crossfade guarantees, ReplayGain, bit-perfect output, ASIO/WASAPI device selection, equalizer, folder watching, M3U import/export, plugins, or streaming yet.
- Artist, album, year, and genre are searchable and sortable columns in Tracks view, alongside the new artist/album browser. Artists use folder names; albums and tracks follow folder order unless another track sort is chosen.
- Moved music receives new IDs; rescanning removes references to missing tracks from playlists. Restore the original path before rescanning if a drive is temporarily unavailable. An inaccessible directory aborts the scan without replacing the collection.
- Library rename, rescan, and deletion are available from its context menu. Creating, renaming, deleting, and reordering playlists are supported. Playlist deletion never deletes audio files.

## Project structure

- `main.cjs`: native folder chooser, IPC, persistence, restricted local audio/artwork protocol.
- `scanner.mjs`: metadata extraction and artwork cache in a worker.
- `media.cjs`: byte-range audio responses for seeking.
- `rating-tags.cjs`: MP3 rating reads and verified writes.
- `preferences.cjs`: settings defaults and whole-star rating validation.
- `tags.cjs`: verified MP3 tag writes, backups, and stale-edit checks.
- `preload.cjs`: narrow desktop bridge; context isolation and renderer sandbox enabled.
- `app/`: interface, playback, and collection filtering.
- `test/`: search, sort, playlist-order, and scanner integration checks.

## Validation

```sh
npm test
```

Source tests validate collection logic and scanner behavior. Desktop launch and audible playback require a supported desktop environment; see `VALIDATION.md` for results from the creation environment.

## Next milestones

1. Run this on your main computer with a small real collection; verify your essential audio formats.
2. Tune layout, interactions, and library organization around your workflow.
3. Add SQLite, folder watching, and playlist import/export.
4. Add a dedicated audio engine for reliable gapless playback, ReplayGain, and expanded codecs.
5. Build and verify signed releases for all three systems.

Technical references: https://www.electronjs.org/docs/latest/tutorial/security and https://github.com/Borewit/music-metadata .


### Batch tag editing (0.27)

Select tracks with Shift-click or Ctrl/Cmd-click, then right-click → Edit tags. All selected tracks must be MP3 files. Shared values are shown directly; mixed fields offer Show values. Typing checks Apply automatically. Uncheck Apply to keep a field unchanged, or check it with an empty value to clear that field across the selection.

Expand Other embedded tags to inspect and choose tags to remove. Artwork, ratings, comments and unknown ID3 frames stay untouched unless checked. Different values appear as separate entries with file counts. ID3v1 and APE metadata are removable blocks. Standard-field edits remove legacy ID3v1 to prevent stale values returning. The editor keeps original-file backups; use Show backups to find them. Files with unsupported ID3 headers are left untouched.

### Large libraries (0.29)

Track views above 300 songs now render only the visible area and nearby rows. All songs remain available in one continuous scrollable list, with full-list selection and drag-and-drop. This reduces display work when opening a large unfiltered library. Album rendering is unchanged.

### Appearance and global controls (0.30)

Settings → Shortcuts → Global playback shortcuts enables Ctrl/Cmd+Left, Ctrl/Cmd+Right and Ctrl/Cmd+Shift+Right while another app is focused. Localtone must remain running. If a binding is unavailable, the setting reports the conflict. Disable it to release the shortcuts.

Settings → Appearance contains background hue and custom accent controls with live previews. Accent presets remain available. Drag the invisible top edge of the seekbar to resize its height. Right-click the seekbar → Lock seek bar height (also in Appearance) to prevent resizing. Height and lock are saved.

### Layout and portable preferences (0.31)

Playlists use the remaining sidebar height above the cover. Right-click either pane divider to fix its width, or to enable resizing again. Column headings are hidden by default, with narrow number/rating/duration columns and a flexible title. Existing customized widths and heading choices are retained.

Portable mode stores preferences and Last.fm data in Localtone-data beside the app. A storage-mode change takes effect on restart. Last.fm credentials are encrypted using the OS and may require reconnecting after moving the folder to another computer or account.

### Shortcuts and tag editing (0.32)

Q exits Localtone, F toggles maximize/restore, and P toggles the queue. These shortcuts are inactive while typing or using a dialog. Shuffle and repeat now turn one another off.

The revised tag editor uses Keep / Set / Clear per field. Typing chooses Set; Keep restores the original value and leaves the field unchanged. Mixed fields show the individual original values on hover. Other embedded-tag removal controls have been removed.

### Playback order and shared columns (0.33)

Disabling shuffle or enabling repeat now restores normal order at the playing track: track 584 is followed by 585. Column settings are shared across all views, using your previous Tracks layout as the starting point. The window minimum height reserves space for five playlists, and only the playlist section scrolls when there are more.

### Album-list performance and background controls (0.34)

Large album lists now build nearby albums first and fill the rest as you scroll. Full selection and dragging still work across expanded albums. Appearance now has saturation and brightness controls alongside background hue, with live previews and saved values. Brightness stays within a dark-mode range.

### UI and keyboard updates (0.39)

Ctrl/Cmd+P toggles Settings. E edits selected MP3 tracks, or the playing MP3 if nothing is selected. Previous/next hardware media-key handlers are now registered. Cover view restores your scrolling position after returning from an album. Settings tabs share the title row; accent presets are replaced by the existing custom color controls.

### Album layout and navigation (0.40)

Album lists now place larger covers to the left of the tracks, inspired by your foobar reference. Click a cover or album heading to collapse/expand. Choose Appearance → Album layout → Compact to return to the old layout. All track rows use 28px. Collapsing an album preserves its position, waveform clicks no longer trap app shortcuts, and All music lives at the end of Libraries.

## Version 0.49

Settings → Shortcuts lets you click a binding and press its replacement. One binding per action; conflicts are rejected. Reset shortcuts restores defaults. S toggles Shuffle, R cycles Repeat, and Ctrl/Cmd+P opens Settings. Global playback shortcuts use your chosen Previous, Next and Random next bindings. Tab switches artist/track navigation; Up/Down selects; Enter plays a selected track. Double-click an artist to play their first album; single-click the selected artist to show all again.

Right-click an album heading to choose its displayed information. Open folder now reveals the selected file or folder in your file manager. Mini mode hides collection controls before resizing and keeps the player anchored during the transition. Cover views reserve a consistent scrollbar gap.

## Version 0.50

Tab switches panes with a subtle accent indicator. Search Enter selects and focuses the track pane; Escape leaves search. Clicking outside a settings dialog dismisses it without saving unsubmitted edits. Reset shortcuts is left aligned. Playlist order now follows Folder order in the sorting menu.

Right-click MP3 tracks or albums for Add leading zeros or Add missing track totals. Cmd/Ctrl-click selects multiple albums; Shift-click selects a range. These actions preserve existing numbering and other tags, write only the track-number field, and retain backups. Totals are inferred from the full local folder/disc, using an existing consistent total where available; incomplete albums without total tags may need manual correction. Enable Number / total under Appearance to display the total. Album information toggles are shared by Albums and Covers.

Keep the existing Localtone-data folder when updating.

## Version 0.51

A adds selected tracks, albums or artists next in the queue, with a compact notice beside the queue area. The shortcut can be reassigned. Queue, indexing and error notices share one themed design.

Tab switches Artists / Tracks; Shift+Tab focuses Libraries / Playlists. Use arrows to highlight a collection, then Enter to open it and focus Artists. Shift+Up/Down selects a range of artists or tracks; normal arrows select one. Focus pulses occur on deliberate pane changes, not each arrow press or settings dismissal.

General → Queue only confirmed search results is optional and off by default. Enable it, search and press Enter, then play a result to build the queue from that confirmed result set. Typing without Enter keeps full-collection playback. Keep your existing Localtone-data folder when updating.

## Version 0.52

X cycles Albums / Covers / Tracks. O cycles enabled sort options in track view. Left / Right cycles Libraries / Artists / Tracks with wraparound; Tab keeps its existing behavior. Enter on an artist focuses Tracks. Escape clears selection in the active browsing pane (and closes an open context menu first). Artist selection supports Shift+arrows, Shift-click and Cmd/Ctrl-click.

A gives selected tracks priority over album context and nudges queued rows briefly to the right. Album keyboard scrolling now reveals only the next hidden edge. Context menus and reset buttons share consistent alignment and sizing. Keep your Localtone-data folder when updating.

## Version 0.53

Shift+O restores Folder order (ascending). Ctrl/Cmd+N creates a playlist; Ctrl/Cmd+L adds a library. These bindings can be changed in Shortcuts. Escape clears track selection and focuses Artists without moving the track scrollbar; Escape in Artists clears the artist selection and focuses Libraries / Playlists. Up/Down wraps between the first and last visible tracks.

Album keyboard scrolling ignores the hidden Tracks table. Queue feedback uses a slower 360ms eased nudge. Library/playlist plus buttons highlight only the symbol. Keep your Localtone-data folder when updating.

## Version 0.54

Settings → Audio selects System default or a detected output. The choice is saved; disconnected devices fall back to the system default and are restored when available again. Refresh devices reloads the list.

Search examples:
- `artist:"Nine Inch Nails" year:>=1994`
- `EXCEPT genre:"hip hop"`
- `rating:>=4 AND (genre:ambient OR genre:electronic)`
- `year:1990-1999 NOT album:remix`

Plain words still match across tags. Operators must be uppercase; field names are case-insensitive. Use quotes for phrases. Numeric duration filters use seconds. Full syntax guidance is in General settings.

Press Enter to confirm a search. In Tracks, Create playlist from results opens the usual name dialog with Dynamic disabled and saves the captured tracks as a regular playlist. The button disappears when you type or leave that result view.

Album navigation includes the heading/cover when the section fits; first/last tracks reveal the relevant edge for taller albums. Now-playing text has equal spacing above and below. Keep the existing Localtone-data folder when updating.

## Version 0.55

- Queue rows show 32px album artwork alongside title and artist instead of playlist numbers. The heading stays above the scrolling list, aligned vertically with Close.
- Enter from Artists or Tab into Covers selects the first cover, or restores the last selected cover. Arrow keys navigate the grid; Enter opens the album. Tab continues to switch panes. Selection scrolls into view only when necessary.
- All 133 automated checks pass. Native desktop appearance remains to be verified.

## Version 0.56

- Opening the queue places the currently playing song at the top; earlier tracks remain above it.
- Settings preserves the active browsing pane. Search: Down focuses filtered artists; Escape clears and exits; the clear button highlights only its symbol.
- Backspace returns from an album opened in Covers to the selected cover and previous scroll position.

### Moving preferences between computers

With Portable enabled, source builds store data in `localtone/Localtone-data`. Packaged apps use `Localtone-data` beside the executable or macOS `.app` (beside an AppImage on Linux). With Portable disabled, data uses Electron's per-user app-data directory. Changing Portable takes effect after restarting.

`collection.json` contains the settings object (appearance, columns, shortcuts, pane sizes, audio preferences and more), libraries, playlists and indexed track information. It is not a standalone preferences-only export. `playback-session.json` stores the last song/time; `playback-history.json` stores listening history; `lastfm.enc` stores encrypted Last.fm data; `covers` and `waveforms` are caches; `tag-backups` contains metadata backups. `storage-mode.json` remembers portable mode; session/log/crash directories contain runtime data. Ratings and edited music tags also live in the music files themselves.

Close both apps before copying data. Back up the destination first. Copy the complete Localtone-data folder for a full migration, or collection.json for settings plus collection data. Music paths and audio devices may differ across operating systems, and Last.fm must be reconnected because credential encryption is tied to the OS/user. There is currently no settings-only import/export UI.

## Version 0.57

- Down from Search immediately selects the first matching artist and filters the main pane.
- General → Storage → Remove old app data backs up and removes the known external Localtone app-data folder after confirmation. It is available only after Portable is active.
- Enabling Portable offers Copy and keep old files, Move and remove old files, or Cancel. Migration/optional cleanup occurs after restart. The full old folder is copied into Localtone-data/external-data-backup-* and each file verified before deletion; active portable preferences are not overwritten by manual cleanup. Close other Localtone instances before cleanup.
- Cleanup refuses overlapping paths, symlinks and special files. Failures are shown under Storage. It does not scan the disk or remove OS-managed recent-file records, old separately installed app copies, or historical backup folders in other locations.
- Playback-session data is now included when migrating storage.

## Version 0.58

- General → Preferences: Export settings / Import settings. Versioned JSON exports contain appearance, columns, shortcuts and browsing preferences; they exclude libraries/playlists, music paths, Last.fm, storage mode, audio-device IDs and current shuffle/repeat state. Import validates first, asks for confirmation, and backs up previous preferences in Localtone-data/settings-backups (or the active non-portable data folder).
- Ctrl/Cmd+Z and the Undo button on edit notifications restore track additions/removals/reordering in regular playlists and queue edits. Up to 50 edits are kept for this session. Typing retains normal text Undo. Dynamic playlists and tag edits are outside this history. Playback is not restarted by queue Undo; incompatible later queue/playlist changes invalidate an older edit rather than overwrite newer state.
- General → Browsing → Play queue: Overlay or Extend window to the right. Extended mode reserves a 224px queue pane while keeping the main view width. Closing restores the previous bounds if the window has not been moved/resized. Insufficient screen width or a maximized/full-screen window falls back to overlay. Near a screen edge, the extended window moves left enough to fit. Mini player closes the queue before shrinking.
- Switching Albums/Covers/Tracks immediately focuses and selects its first item (or remembered cover), so the first arrow press moves the selection.
- Deferred next: reconnect moved folders; gapless playback verification; missing-file overview.

## Version 0.59

- Redo: Ctrl/Cmd+Shift+Z, editable in Shortcuts, plus Redo on an Undo notification. A new edit clears redo history. Existing custom bindings survive migration; older settings exports gain the new binding.
- Right-click a library → Reconnect folder. Choose its new root with the same internal artist/album structure. Matching uses relative paths and file sizes; mismatches and zero matches are rejected. A confirmation shows matching and still-missing counts. Existing IDs, playlists, ratings and listening references are preserved. Music is never moved or deleted. Windows-style stored paths can reconnect on macOS/Linux and vice versa. Renamed/reorganized individual files are not guessed automatically.
- General → Library maintenance → Missing files lists missing/unavailable tracks grouped by library, with paths, reasons, Check again and Reconnect folder. Scans retain missing entries and playlist references. Returning files recover their existing IDs.
- Gapless assessment: completed; true gapless playback is NOT implemented or verified in this release. Current HTML audio playback changes the source only after the ended event and can introduce gaps. See GAPLESS-ASSESSMENT.md.
- Packaging includes all new transfer, queue-window and library-repair modules.

## Version 0.60

Portable cleanup accepts symbolic links inside the old data folder, including broken links. It backs up link objects with their exact targets without traversing them. File contents, directory entries and link targets are compared before removing the source. Root-folder links and overlapping storage locations still block cleanup. Special files such as sockets and named pipes block cleanup with their exact path in the error. Close other Localtone instances before retrying. No external link targets are modified. Cleanup messages omit the Electron IPC error wrapper, and successful cleanup clears stale startup errors.

## Version 0.61

- Typing in Search clears the selected artist(s), so results initially cover the full current library/playlist.
- Undo/Redo notifications accept pointer clicks. Closing Settings (X or backdrop) restores focus without a pane pulse.
- Audio → Gapless playback enables a new buffered playback path. It is optional and off by default to preserve the lightweight playback path. FFmpeg decodes the current and next track into stereo PCM at the AudioContext output rate. AudioBufferSourceNodes schedule the next buffer at the end of the current buffer, without crossfade or silence trimming. Queue edits, seeking and pausing cancel obsolete scheduled nodes; repeat-one schedules the same decoded buffer again.
- Gapless uses additional memory. Each decoded track is limited to 256 MiB; very long or unsupported files fall back to normal playback. The limit is roughly 11.6 minutes of stereo audio at 48 kHz. Decode failures/limits appear in the Audio settings status. Encoded audio uses FFmpeg's delay/padding handling. Full decoded buffers may delay initial playback while loading.
- Output selection and volume apply to both playback paths. New decoder processes are cancelled on source changes and quit.
- 154 tests pass. Audio-clock scheduling and real decoded adjoining signals are tested; native device loopback/listening verification remains outstanding.

## Version 0.62 — startup fix

Version 0.61 included buffered-audio.js in the ZIP but omitted it from the internal app-protocol allowlist. Its static import therefore failed, preventing renderer initialization, icons, saved appearance and shortcuts from loading. Version 0.62 explicitly serves that module. A new regression traverses every renderer module import through the main-process protocol handler, while confirming private files remain inaccessible. No settings reset or collection migration is needed.

## Version 0.63 — animated window transitions

- Mini player shrinks toward the bottom-left over 240 ms with easing, retaining the normal layout while the window clips it. Restoring reveals that same layout and restores the saved window bounds. Artwork and sidebar spacing stay fixed during the transition.
- Extended queue is revealed from the right as the native window grows; closing reverses the transition. The normal content width stays fixed during the reveal. Insufficient desktop space retains the overlay fallback.
- Window actions are serialized, responsive minimum-size updates are paused during transitions, and the renderer waits for the final viewport before releasing its frozen layout. OS reduced-motion preference disables interpolation.
- 159 automated checks pass, including intermediate geometry, exact restoration, reduced-motion geometry, and overlapping window actions. Native animation smoothness needs desktop verification.

## Version 0.64 — album selection and batch rating

- Shift+arrow extends/shrinks cover selection from a stable anchor. Enter opens all selected albums together in detail view.
- Cmd/Ctrl+0–5 applies the rating to all selected tracks, or every track in the selected albums. Values are written using the existing metadata rating path; individual failures restore only failed ratings and report the error.
- Empty artist-pane space accepts focus. Album headings no longer use a colored selected background or native text selection.
- Track, album and artist context menus include a DuckDuckGo search in the default browser. Album context menus include Add to play queue; selected covers use the same queue nudge as rows.
- 161 automated checks pass. Desktop visual behavior and browser launch remain to be checked on the target OS.

## Version 0.65 — stable mini-player transition and selection feedback

- Mini transitions display an in-memory app snapshot, decoded before native resizing starts. The live interface is hidden until final layout settles. Restoring combines the saved normal view with the current mini-player image. Snapshots never leave the app or write to disk.
- Selected covers have visible inset outlines above their artwork, including Shift+arrow selections.
- Search artist/album/track on web sends a DuckDuckGo !g query to the default browser.
- The existing Overlay / Extend window queue setting now controls shadows too: only overlays cast a left shadow. Queue drag/drop retains Undo history without an Updated queue notification. Shuffle-next reveals the playing queue row. P in mini mode does nothing silently.
- 163 automated checks pass across the complete suite and additional native snapshot test. Native animation appearance still needs desktop verification.

## Version 0.66 — album navigation and stable mini switching

- M now switches directly between mini and normal window bounds. Snapshot capture and mini size interpolation are removed; the queue keeps its animation. Other panes are hidden during the switch.
- Cover selections use contrasting borders and dark-backed check badges. Keyboard focus alone no longer creates a stale selected-cover outline.
- C expands/collapses the selected album or the parent album of selected tracks; with no album selected, it toggles all displayed albums. Collapsed albums participate in arrow navigation with a heading outline. The new shortcut is editable and old bindings migrate without collisions.
- Context menus share action groups and separators: playback, editing, tag formatting, folder/web, maintenance and removal. Artists and albums also offer Add to play queue and Edit tags when applicable.
- 163 tests pass; the final context-menu additions also pass all 59 renderer checks. Native appearance still needs desktop checking.
