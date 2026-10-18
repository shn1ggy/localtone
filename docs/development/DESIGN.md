# Localtone desktop design rules

These rules are the current implementation contract, not a chronological wishlist. DESIGN.md governs geometry and interactions; app/design-defaults.js governs saved defaults; RELEASE-READINESS.md tracks deliberate remaining limitations.

These rules describe the current preferences language. They apply to new function windows as well as Settings. Preserve existing user preferences; do not overwrite values to match screenshots.

## Dimensions and rhythm

| Element | Rule |
| --- | --- |
| Preferences/review dialog | 680px wide, constrained to viewport with at least 16px outer clearance |
| Main Settings height | Fixed 80vh across every tab; header remains fixed, body scrolls |
| Other function dialogs | Content-sized, maximum 80vh; scroll only long content |
| Content edges | 20px padding |
| Title | 18px, semibold, 24px line height |
| Body, labels and controls | 13px |
| Section heading | 13px semibold, muted; 20px line height |
| Help/status text | 12px, line height 1.45 |
| Standard row | 36px, vertically centered |
| Input, select and button | 28px high, 5px corner radius |
| Context-menu command | Existing compact 12px text, 28px row; shared menu styling and checkmarks |
| Standard dropdown | 245px wide; numeric input 72px |
| Button width | Fit text; paired startup actions share the longest-label width; icon-only close/action 28px square |
| Enable switch | 30 × 17px with 11px thumb |
| Section separation | 16px total, one subtle 1px divider |
| Heading to first row | 8px |

## Alignment and space

Use one shared row: flexible label, 16px gap, 245px control area. Labels share one left edge and controls share one right edge. Numeric inputs, switches and text-fit buttons align to the right of that control area. Labels and controls must be vertically centered. Do not add decorative cards, oversized headings or extra dividers beneath headings.

Review tables may use flexible title cells and fixed data/action columns. Per-row switches belong at the far right. Sticky headers must have an **opaque theme-aware background**, an explicit stacking layer, and no scrolling content painted through them. Use separate table borders for reliable sticky headers. Only table contents scroll; titles and actions remain visible. Reserve room for scrollbars without horizontal overflow or cramped right padding.

Reset buttons belong at the left of the footer. Guides may align right on the same row. Keep footer buttons identical to normal text-fit actions.

## Color and interaction

Use the current theme variables: charcoal surfaces, off-white primary text, readable muted secondary text, subtle borders and the user's accent (cyan by default). Avoid hard-coded green or screenshots' sample colors. Enabled switches use the accent; disabled controls are dim. Reuse `.preference-switch` for review dialogs rather than native checkbox visuals. Native checkbox inputs with `role="switch"` retain keyboard and accessibility behavior.

No focus outlines or background hover blocks on icon-only actions. Hover changes the symbol. Keep existing pane-focus feedback and selected-cover outlines/tints; do not introduce random album/title outlines. Noneditable labels are not selectable; inputs remain selectable. Controls need accessible names and reliable keyboard operation despite the restrained styling.

## Help and menus

Use the centralized settings help map and reusable help popover. Help is closed initially. A question mark follows its label by 6px, in a 24px clickable area. Popovers float outside scroll containers, approximately 300px wide, with 14px padding and 6px corners. Open above if needed. Only one opens at a time; outside click, Escape, close or tab changes dismiss it. Restore trigger focus for Escape/close.

Long guides open in a separate 480px modal with independent scrolling, a focus trap and Escape priority. Do not expand documentation inline and push rows down.

Context menus are left aligned and use consistent command ordering and separators. Use an ellipsis for commands that open a dialog requiring choices, not immediate commands or toggles. Enter on a checked option changes it without closing the menu; other actions close it. Escape restores focus.

## Loading and motion

Do not show fallback icons or unsaved theme colors at startup. Apply preferences and initialize the UI before revealing the native window. Silent layout fallbacks need no notification. Show errors when an operation genuinely fails.

Use compositor-friendly transforms for queue feedback; avoid animated blur/filter, forced per-row layout reads and repeated allocation. Respect reduced motion. Preserve current selections and scroll positions when updating content.

## Verification before delivery

Check at 100% Electron zoom with a normal desktop viewport and a shorter viewport. Confirm equal row/control dimensions, common label/control edges, fixed Settings height, no overflow, visible scrollbars, opaque sticky headers, correct switch accent and keyboard behavior. Test scrolling with enough rows to expose sticky-header errors. Run relevant behavior regressions without changing saved values.

## Close buttons and function links

Every preferences/function-dialog close action uses `createIcons(...).setIcon(button, 'close')`, never a text `×` or an OS-dependent font glyph. Use `.dialog-close`: 28 × 28px hit area, centered 18 × 18px shared SVG, stroke width 1.7, zero padding, transparent background. The hover accent affects the icon only. Give it a specific accessible close label. Apply this to Settings, tag editing, playlist settings, guides, lookup, confirmation/name and playlist-picking windows; retain the independently aligned queue toolbar action.

Use a visible Rules / Search expression mode selector for dynamic playlist filters. Both modes share the same source library and match preview; inactive controls are hidden. Keep queries and rules when switching mode. Search help opens the same separately scrollable guide used by Settings.

Playlist destination submenus open alongside the parent menu, flip left if needed, stay inside the viewport and scroll internally for many playlists. Right enters the submenu; Left or Escape returns to the parent. The `+` action opens a compact destination picker for the current selection. Exclude dynamic playlists from writable destinations.

MusicBrainz review is part of Edit tags, never a second dialog or duplicate context command. Manual editing is the initial compact view. Optional comparison shows Field / Local value / MusicBrainz proposal / Use in aligned 36px rows, with editable local and proposed values and a switch at the far right. Local edits apply to the selection; release proposals apply to the album chosen in the Album selector. Each album retains its review when switching. Available fields are opt-in; unavailable values and unmatched tracks remain unchanged. Track-number matching sits below the same comparison and shares its Save / multiple-file confirmation, validation and backups. Exact, unambiguous matches can preselect track-number updates; other tracks require an explicit match.

Disable the release dropdown while searching/loading and show the shared small loading indicator with an accessible status. Distinguish no results from errors; errors offer Retry. Reuse tags already read by the editor. Ignore responses after closing, changing albums or saving. Keep the main browsing view, expanded albums, selection and scroll position when applying changes. Function dialogs scroll internally, retaining their header/footer; comparison and track-table headers are opaque and sticky.

## Session undo and naming windows

Tag and rating recovery stores metadata-only snapshots, never complete music files. Recovery belongs to the current session and shares Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z with playlist/queue/naming edits. Display the short “Undo available until exit” note in the tag-editor footer. Remove permanent tag-backup browsing. On normal exit, wait for writes to finish, then delete the tag-backups folder, including legacy full-file backups. Settings/collection backups are separate and stay intact. Reject restoration if an external file edit would be overwritten.

Every function window, including Add library/name entry, must have the same visible close SVG and hit area. Use the shared close-button class for size, color and hover; do not introduce ID-specific close colors that override it. Verify the actual hovered icon becomes the accent without a background block, and test the click. Test hover at its settled color after any existing transition.

Submenu arrows use a small stroked chevron at the far right edge of the menu row; reserve a consistent 16px gap from the label. Preserve submenu keyboard navigation and viewport placement. All enable controls reuse the shared preference switch; reset inherited native checkbox sizing and flex basis so the rendered size is actually 30×17px.

Naming uses a compact 680px window with independent Album folders / Track files switches, 28px formula inputs and a closed Formula fields guide. Defaults are `%year% %album%` and `%tracknumber% %title%`. Show a before/after preview, collision/error status, preserved extensions and full destination paths on the preview cells. Require a fresh preview after any edit. Use 13px primary table text, 12px opaque sticky headers, 36px rows, shared close/primary buttons and fixed header/footer around scrolling content. Album-folder changes move all contents; make that clear beside the preview. Keep last-used formulas in normal saved preferences. Preserve track IDs, memberships, selection, expanded detail and scroll while updating paths. Naming supports session undo/redo and must refuse overwrites and roll back failed transactions.

The General → Library leading-zero switch controls Add total tracks independently of MusicBrainz’s saved leading-zero choice. It changes only newly added totals; existing totals remain untouched.

## Queue feedback and persistent disclosures

Queue-add feedback lasts 650ms per selected row, artist or album, with immediate outward motion and a separately eased return. Stagger each pane from first to last over 300ms total, independent of selection count. Draw a restrained accent glow once and animate its opacity; never animate blur, shadow radius or filters, and never force a layout read for each row. Reuse glow elements, cancel earlier feedback safely, remove animation layers when finished and honor reduced motion. Feedback must not create horizontal scrollbars.

Edit tags uses independent Tags and Track numbers disclosures, initially expanded. Store their open states with the other preferences; closing a section must retain pending edits and proposal choices. In extended queue mode, the queue spans the complete right edge, including waveform height. Reserve 224px at the waveform's right edge so its original width stays stable; overlay mode retains its original bottom clearance.

## Ownership and maintenance safeguards

- `app/design-defaults.js` supplies new-install appearance defaults; `preferences.cjs` validates persisted values. Existing preferences always win. Never duplicate a new default only in CSS or reset code.
- `app/style.css` owns the common dialog, row, switch, close-button, table and menu rules. `app/icons.js` owns icon geometry. Reuse these before adding a local override.
- `settings-help.js`, `settings-tabs.js` and `dialog-coordinator.js` own help, tab navigation and modal focus respectively. Function windows must use the same dismissal/focus path.
- Do not remove a CSS rule merely because an identifier inside `:not()`, `:is()` or another functional selector appears unused. A selector list can still style live elements. Preserve rule order unless the rendered cascade has been compared.
- Inspect all six Settings tabs at 100% zoom, normal and short heights; compare control geometry, not just screenshots. Include enabled and disabled switches, expanded disclosures, keyboard focus and error/loading states.
- Format runtime sources using `npm run format`; run `npm run verify` before release. Behavior tests do not replace native rendering or real audio-device testing.

## About and release actions

About uses the same Settings header, 80vh body, 36px rows and right-aligned text-fit chip buttons. Show the version from the native app, not hard-coded renderer text. Keep runtime information secondary, show the actual storage mode and let users select the data-folder path. Use the normal error/status area for update preparation; no new toast style or modal design.

Update preparation is explicit and local: verify the chosen release, confirm data copying, stage persistent data and preserve the old version. Never replace another destination's existing data. Keep source versus desktop builds visible; online checking uses only the fixed project GitHub release feed and must distinguish unavailable releases from an up-to-date app. Never imply that a download installs or restarts the app.

## Shared text buttons — required

Use `.chip.dialog-button` for secondary function actions (Cancel, Find release, Retry), `.primary.dialog-button` for Save/Apply, and `.settings-link` for guide/comparison links. All text buttons use the app font family, **13px text, 20px line-height, 28px height, 0 10px padding, 5px corners**, with inline-flex centering and widths that fit their text. Secondary actions use a subtle 1px theme border and muted text; hover changes text to the accent. Primary actions retain the accent fill and 600 weight; secondary/link text uses 400. Links have no border and no horizontal padding. Close icons and enable switches keep their own shared dimensions.

Do not introduce a dialog-specific minimum width, browser-default font, oversized padding or alternate button height. Reuse the shared rule for dynamically created actions as well as static markup. Check actual computed font family/size, line-height, padding, height, border radius and centered baselines in Electron for manual tags, expanded MusicBrainz review, loading/retry, footer actions and confirmation text. Compare against Settings buttons at 100% zoom.

General → Library contains Confirm multi-file tag edits, enabled by default. Its saved value controls the second Save confirmation for both manual tags and MusicBrainz proposals. Disabling it bypasses only the extra multi-file confirmation; validation, saved field choices and session undo continue to apply.


## Dialog audit contract

All function and settings dialogs share `--text-primary` (neutral off-white) and `--text-muted` (neutral gray), including table values, formula inputs, placeholders and status notes. Do not use separate green/blue text palettes or hard-coded text colors in individual dialogs. Accent is reserved for interactive links, active tabs, enabled switches and primary actions; errors use the shared error color. Apply the same 13px/20px label/control text, 18px/24px titles, 13px/20px semibold section headings, 12px/1.45 notes and 36px rows to all windows. Formula tokens use monospace at 12px without changing their color role. Text buttons in dialog footers and preview actions must use the shared dialog-button class, including dynamically created buttons. Keep close icons distinct from text actions.

In Edit tags, the Field/Use grid, leading-zero switch and track-number Use column share the same right edge. Reserve the nested table scrollbar gutter consistently even with only one track; center every switch vertically. Verify both manual and MusicBrainz views with short and scrolling tables.

Rename files and folders uses F2 by default; Repeat mode uses R. Migrate the old default Repeat binding without replacing customized shortcuts or assigning duplicate bindings.


Queue updates reveal the active occurrence whenever playback advances, order/mode changes, or the collection switches while the queue is open. Unrelated filtering and metadata updates retain user scrolling when queue rows have not changed. Never select the first occurrence by track ID: duplicate tracks are valid; the playback cursor identifies the active occurrence. Now-playing time uses the same neutral muted text token as other secondary text, including all child spans.

A fresh portable data folder starts empty. Never automatically copy legacy system data on first launch. Existing local data is preserved; only an explicit storage-mode change migrates current app data. macOS stores portable data beside the .app bundle, so apps beside the same Localtone-data folder intentionally share it.


Output selection reports success only after both playback backends accept the route and the saved preference matches it. A live native stream is reopened at its current position; a paused track remains paused. A running Web Audio context is suspended for routing and resumed afterward. Roll back both routes on failure. Cancel obsolete reload work on track changes or shutdown; never restore a previous song's position onto a new song. Hardware tests must include Bluetooth connected while selecting built-in speakers, and the reverse; automated mocks cannot establish audible output.


## Pulse branding and collection exports

The Localtone mark uses four asymmetric rounded waveform bars. `app/icons.js` owns the theme-colored sidebar mark; `app/pulse.svg` and `build/app-icon.svg` contain the vector assets. Desktop icon files use the same silhouette in cyan on charcoal. Keep the native icon assets synchronized when changing the mark.

General → Settings & storage uses the shared 30×17 switch for Include playlists & libraries, disabled by default and remembered. Export contains only settings unless enabled. Collection backups include library roots, track references/metadata, playlist order and dynamic configuration; exclude audio, artwork cache, credentials and device/storage changes. Import validates before confirmation, backs up existing settings/collections, matches existing libraries/files by path, preserves existing metadata and appends playlists with fresh IDs and remapped rules. Never overwrite music files. Explain path portability and rescanning artwork through the shared help popover.


Pulse motion changes the four SVG rectangle heights and y positions, never their scale or corner radius. Motion runs only during actual playback; pause, buffering, seeking, ending and errors freeze the exact current frame. Resume continues from that phase. Suspend animation frames when hidden or reduced motion is requested. Right-click the brand opens Animate logo as the standard checked context-menu toggle, saved in normal preferences. This single-option toggle closes on Enter/click. Disabling freezes the current geometry; enabling resumes that phase. New launches begin with the static mark and blend into motion over 400ms without scaling the caps.

Search filters browsing only. Confirming search preserves the active tab, focuses its content and offers Create playlist from results across Albums, Covers and Tracks, but playback always seeds the complete source collection. Remove the old confirmed-search queue control and ignore its retired value in legacy settings imports.


Browsing sessions restore the current collection, artist/track/album selection, expanded albums, focused pane, search, sort, view and pane scroll positions before showing the window. Keep sessions in browsing-session.json inside the actual app-data folder, including portable storage. Deleted collections fall back safely to normal opening preferences. Persist normal window geometry (excluding a temporary queue extension or mini player), clamp it to the available monitor, and restore the queue-open state in the saved presentation mode. Use synchronous atomic session writes on unload so closing cannot race an async preference write. Never start audio automatically on restoration.

Remove leading zeros edits only the numeric track-number components, including totals, preserving all other tags and audio and supporting session undo. Use the same command across artists, albums and tracks. The playlist submenu chevron is 4px with the existing 1.5px stroke, right-aligned.


Startup checks known file size/mtime with bounded concurrency and rereads metadata only for changed/returned files. MP3 ratings are refreshed from file tags; modified-date rules use filesystem mtime. Preserve prior metadata if a changed file is temporarily unreadable during synchronization. Offline libraries retain indexed files; a missing file is not proof of deletion. Normal library folders are quietly reconciled at startup, on return to the app and periodically while active. Individually imported tracks refresh only their known paths. Unavailable records stay recoverable but are excluded from browsing, artists/albums, dynamic matches and playback pools.

Artist-pane Select all selects the artists currently shown by search. Selection-based actions (tag editing, naming, queueing, ratings, playlists) use all tracks belonging to those artists. Naming validates current filesystem availability rather than rejecting a stale missing flag, and reports the specific unavailable path.

General → Settings & storage has a text-fit Clean unused cache action and shared help popover. Delete only generated regular cache files inside the known covers/waveforms folders, never follow links. Keep current cache keys and an active waveform job. Preserve music, preferences, library state, backups and undo. Report reclaimed bytes through the normal inline status. Empty destination submenus must accept Left/Escape even when focus remains on their parent trigger.


## Missing and renamed files

Missing files supports per-entry Reconnect… and Forget entry… alongside library-root reconnection. Suggested replacements are hints based on size, duration and tags, never automatic identity. Show the original path, compact 245px replacement selector, matching evidence and shared 28px text-fit actions. A native confirmation presents old/new paths before reconnecting or explains playlist-reference removal before forgetting. Only genuinely absent files may be forgotten. Reconnection retains the original ID, merges an already indexed replacement, refreshes tags from the selected file and remaps playlists, queue and sessions. Neither operation moves or deletes audio files. Keep review header and status outside the scrolling list; use normal shared close icon, neutral text and theme colors.

Context menus navigate vertically using Up/Down (plus Home/End). Left/Right do not change the active menu item: Right opens a destination submenu; Left returns from that submenu, including when it is empty. Keep track-number commands in one group, in the order specified under the track-number command contract below.


Rename review lists only valid changed names, never matching names. Show a compact status with changed / skipped problem / already matching counts. Put per-item problems in a separately scrollable, initially collapsed disclosure using neutral 12px notes; keep 28px shared actions and a fixed header/footer. Missing files, invalid per-item names, metadata conflicts and destination collisions do not suppress unrelated valid previews. Apply only the valid listed plan, preserve overwrite prevention, recheck affected sources and destinations, and retain rollback plus session undo/redo. Do not let unrelated unchanged or skipped files invalidate apply.

Unavailable files is optional recovery review, not routine library maintenance. Its short inline description explains that records are hidden from browsing and reconnection preserves playlist references. Automatic directory refreshes use worker scanning without indexing popups, preserve current browsing scroll/selection and skip modal editing. Reuse cached metadata for unchanged files; disconnected roots must never purge saved references.

Rename Special characters is a closed disclosure with shared 36px label rows and 245px replacement inputs. Empty values remove the character; defaults retain underscores. Save replacements with settings, never modify tags, reject unsafe replacement strings, and preserve file extensions. Preview Use switches align to the far right and select file/folder moves independently. Recompute destination paths when folder moves are deselected; reject selected moves that depend on a deselected move vacating a destination. Only selected moves participate in apply validation and undo.

Duplicate review lives in General → Library and uses the shared compact dialog, 28px actions, 36px rows, neutral path labels and right-aligned 30×17 Use switches. All removal switches start off. Distinguish byte-identical files from possible artist/title/duration matches. Keep at least one unchanged available copy per reviewed group; recheck file identity/content before removal, require confirmation and use system Trash, never permanent deletion. Only explicitly removed files lose playlist references. Scans cannot overwrite music. Album disc separators are subtle 1px borders at disc-number transitions, without changing row height, selection or navigation. Search disc presence uses raw disc tags, never the Disc 1 display fallback.

Track-number command order is Renumber by folder order, Add total tracks, Add leading zeros, Remove leading zeros. Keep commands visible but disabled when inapplicable. Renumber requires every available track of exactly one full indexed album, using the same folder-based album identity as browsing; a search/playlist subset cannot masquerade as a complete album. Recheck in the main process, preserve non-number metadata/audio and undo. Natural folder ordering assigns sequential numbers per disc, retaining existing padding and valid totals. Other commands enable if any selected MP3 has an actionable number/total component and write only changed tags.

Mixed tag values use an empty input with the multiple-values placeholder until explicitly edited. Delete/Backspace (including beforeinput deletion from alternative input methods) in that empty mixed row must mark an explicit empty patch, remove the placeholder and use the existing changed-row feedback. Merely focusing/leaving a mixed row never clears tags. An accessible description explains pending removal; retain standard confirmation and session undo. No extra buttons or new row geometry are needed.

## Public usability and accessibility contract

- Every text input/select/switch needs a programmatically associated label. Icon-only actions need an accessible name; shortcut buttons identify the command, not just its key. Controls that look like switches use `role="switch"`. Native controls retain their keyboard semantics.
- Keep keyboard focus perceptible without adding outlines: dialog text actions and disclosure labels never underline on `:focus-visible`; preserve text contrast and existing restrained control/symbol color feedback; tab names retain the shared selected-tab surface without an extra underline; close icons use the accent; switch borders brighten without implying a changed value. Text fields retain the existing subtle focused surface. This is keyboard-only feedback; mouse hover rules are unchanged. Color changes alone are not sufficient for selection: retain position, tint and selected-state indicators.
- Rebuilding a focused setting must restore the logical control with `preventScroll`, including accepting/cancelling shortcut recording and resetting shortcuts. A dialog closes back to its opener without an extra pane flash. Escape acts on the innermost help/menu/dialog before the main window.
- Do not interpret Enter/arrows during IME composition as search confirmation or app shortcuts. Verify a non-Latin query.
- Empty collection, empty playlist, empty search, loading, unavailable data and errors are different states. Use one shared empty-state area across all three views; first run must expose Add folder in Covers as well as Albums/Tracks. Keep error/status text actionable and neutral. Never show duplicate empty messages in the same content pane.
- General has grown beyond its original row budget. Preserve 36px rows and 28px controls rather than shrinking text to hide overflow. All tabs keep the same 80vh shell and fixed header. A future information-architecture pass should separate library maintenance/storage; do not add a seventh cramped header tab ad hoc.
- At least 16px outer dialog clearance, 20px content padding and a stable scrollbar gutter apply at short heights. For nested scrolling regions, verify that headers/footers never hide focused rows or save actions. Long paths/names must not widen the dialog; show their full value accessibly.
- Default text should target 4.5:1 contrast for body text and 3:1 for meaningful non-text controls against their actual surface. Current very dim track numbers/durations/empty stars and arbitrary user colors have not been certified to meet these targets; track this explicitly rather than claiming accessibility compliance. A future readable-contrast option should preserve existing custom preferences.
- Test native keyboard-only operation separately from screen-reader accessibility. Pane cycling intentionally differs from ordinary Tab order. A future toolbar-focus route and optional conventional navigation must be designed explicitly; do not silently change existing Tab behavior.

### Required state matrix for UI review

| Surface | States to inspect |
| --- | --- |
| Settings (all six tabs) | Normal/short viewport, selected tab, footer after scroll, focused control, switch off/on/disabled |
| Function dialogs | Empty/single/mixed selection, loading/error/retry, long content, pending save, close/Cancel/Escape/outside click |
| Menus | Mouse/keyboard, disabled action, checked option remains open, empty submenu, viewport edge |
| Browsing | Empty source/search, first/last item wrap, Shift range, pane return, cover detail Backspace, hidden headings |
| Playback | Paused/playing, seek/volume focus, queue duplicate occurrences, shuffle/repeat, mini/extended presentation, reduced motion |

Do not add new one-off colors or sizes to repair a single dialog. Measure the shared selector's computed style first. Links use zero horizontal padding; secondary/primary buttons use 10px. A general button selector must not override the link rule. Keep 13px rule-selector measurement in sync with its rendered font.

## Revealing the playing song

Clicking the now-playing artwork keeps the active Albums, Covers or Tracks tab while returning to the playing song’s original library/playlist and selecting/revealing that song. Covers opens the song’s album detail within the Covers tab; Back returns to the cover grid and its saved position. Transport navigation that requests view preservation follows the same rule. Do not force the Albums tab to reveal a song.

## Text roles and selection clearing

Appearance → Colors has Primary text and Secondary text, using the existing shared 28px color control. Defaults are `#e0e4e7` and `#a1a5a8`. Save, export/import and Reset appearance use the same validated preferences as other appearance controls. Primary text covers track/album titles, artist-pane names, main labels, editable values and dialog titles. Secondary text covers metadata, descriptions, section headings, placeholders and inactive secondary actions. Track numbers, durations and empty rating stars retain a darker shade derived from secondary text (`--text-dim`). Use these tokens throughout the app; no separate hard-coded green/blue text palettes. Interactive accent, selection, error and on-accent contrast colors remain semantic roles rather than font-color overrides.

Backspace clears the focused Artist/Tracks selection without changing panes, applying a focus pulse, scrolling or deleting music/playlist membership. Remember the last navigation item independently of selection so arrows resume from it, including collapsed albums and covers. Returning through Tab must not select the first item after this clearing action. Delete still removes selected tracks from a regular playlist. With no selected tracks in a cover album detail, retain Backspace as Back.

Double-clicking a sidebar playlist chooses a random available song and seeds its complete collection queue in the current view's sorting order, retaining shuffle/repeat mode. Empty playlists leave playback intact. Quit defaults to Ctrl/Cmd+Q, including while editing a field. Migrate the former Q default without overriding other custom shortcuts or creating collisions.

Online updates reuse About's normal setting rows, text-fit chip buttons and neutral status area. Release notes stay closed initially and render as plain text in a bounded scroll area. Check/download operations are explicit, cancellable during transfer and never modify playback or preferences. Show compatible version and download size; reveal only successfully verified files. Hide the Check button during downloads to retain the 245px action-column geometry. Extract → Prepare update remains the installation path until native replacement/restart is validated.

Pane-focus pulses use one noninteractive fixed overlay spanning the height above the waveform; the waveform is never tinted by artist/track pulses. Sidebar covers its entire width; artist spans its left edge to the exact left edge of the Albums tab toolbar; tracks start at that same edge and span to the right window edge or visible queue edge. Do not inset pulses by content padding or animate an entire window wrapper. A playlist submenu preview does not capture Up/Down/Home/End until focus enters its items with Right; these keys close the preview and continue the parent menu. Clicking now-playing artwork clears the artist filter while preserving the active browsing tab and playing collection. Extended queue closing keeps the queue width reservation until the frozen layout is released; commit both class changes in the same task to prevent a one-frame waveform stretch.

Confirmed search snapshots persist across tabs and artist filters; clear them only when the search changes/is cancelled or the collection changes. Sidebar focus feedback is positioned inside the sidebar. Use one restrained three-bar playback marker for source collections and playing tracks; selection retains its own surface. Album title emphasis uses accent text, never text outlines, on hover or album/contained-track selection. General → Library has Ignore discs when renumbering, off by default; on assigns continuous natural folder-order numbers across discs while preserving disc tags and valid existing totals.

Album-list/detail titles select the album and all contained tracks; only artwork clicks expand/collapse. C and Shift+C retain keyboard expansion. Title selection preserves scrolling and uses accent text.

Playback markers retain the original three-bar 10×12px shape: 2px bars at x=0/4/8 and initial y/height=4/6, 0/12, 2/8. Animate height/y with the logo’s 2.5-second sinusoidal rhythm and 400ms entry blend, sharing its clock during playback. Do not replace the marker with the four-bar logo or change its dimensions. Sidebar labels and leading icons remain left aligned whether or not a marker is present. Pause/buffering/seek/end freeze their frame; reduced motion and hidden windows suspend it. Disabling the logo freezes only the logo, leaving playback markers active. Source markers align with the center of the sidebar section’s 26px add button. The sidebar focus pulse covers its entire bounds with zero insets; artist/track pulses meet at the Albums toolbar edge and stop above the waveform.

Online checks for 0.x early-access builds include published numeric prereleases from GitHub’s release list; stable 1.x+ builds accept stable releases only. Exclude drafts and unsupported tags, order versions numerically, and retain compatible-platform/archive/hash validation. A published current version reports up to date, not a private-repository error.

Dynamic playlists draw only from registered user libraries, never internal imported-file containers belonging to regular playlists. This boundary applies to rule/search previews, playback-history membership and freezing a dynamic playlist. Disc is a numeric rule field (with empty/nonempty comparisons), using the metadata disc number.

Update requests use Node fetch in the Electron main process so manual redirects remain observable. Validate every redirected HTTPS host before requesting it, keep bounded streams, abort support and SHA-256 verification, and verify real check/download behavior inside Electron before publishing an updater change.

Quit commands always enter the existing safe shutdown path, waiting for active writes and declining new tasks. Busy notices use plain language, and shared toasts remove Electron IPC prefixes. Batch tag saves validate all selected files before writes, use at most two concurrent MP3 tasks, drain active work before rejecting, preserve ordered outcomes and external-change checks, and close the editor before rebuilding the browse view. Renumbering corrects totals per disc (or across the album when Ignore discs is enabled); the existing totalLeadingZeros preference now applies to both renumbering and total insertion, without changing saved values.

## Playback reveal and track metadata display

Sequential playback navigation reveals rows with nearest-edge scrolling. Shuffled-next uses the explicit artwork reveal, aligning the album heading/cover (or track row in Tracks) to the pane top. Preserve the collection scroll position and expanded albums when the playing collection remains open; a visible row must not be vertically centered. Clicking blank track-pane space clears track/album selection without scrolling or changing the active pane.

Appearance → Albums & tracks offers a saved Show disc number switch, off by default. Prefix the displayed track number with the metadata disc number and a dot, preserving raw zero padding. Untagged discs display as disc 1. The number column reserves enough width for the complete displayed value. Finder/Explorer playlist imports remain playlist content and do not enter All music or dynamic playlists.

## First launch and empty collections

A fresh collection shows Add a library and Import settings actions in the main pane. Keep the existing shell, tabs and keyboard pane navigation; do not open a setup wizard automatically, hide the artist pane or change saved preferences. Use 28px text-fit buttons, 12px main-window text (matching the toolbar), an 8px action gap and the current theme. Import settings reuses General's import flow, including validation, confirmation and backing up existing preferences; pending actions are disabled and errors/cancellation leave a usable first-launch screen. Tab into the empty track pane focuses Add library; Tab continues to Import settings, then Artists. Shift+Tab retains sidebar navigation. Native Enter/Space activate these buttons. A first-launch import applies the saved browsing tab/order; imports from an existing collection retain current browsing behavior. Empty playlists, search results and indexed-but-empty folders use their own concise guidance.

## In-place browsing refreshes

Ratings (optimistic, saved and failed), metadata updates/rescans, column adjustments and album-info toggles must preserve both track-pane and artist-pane scrolling. Restore the viewport and refresh virtual rows synchronously before painting; lazy album mounting uses the preserved viewport. Restore surviving track/artist/album focus with preventScroll, without a pane pulse. Collection/search/view navigation retains its intentional navigation behavior. Album title Shift/Ctrl/Cmd selection repaints all tracks belonging to the selected albums, including removing stale row highlights; collapsed albums retain the same complete logical track selection for editing, ratings and queue actions.

## Direct now-playing reveal and library relocation

Clicking now-playing artwork preserves the active tab and playing collection, clears artist filtering and selects the current track. Align the album heading/cover to the pane content top in Albums/cover detail, or the current row below any visible column headings in Tracks. Add only the trailing room needed for an end-of-collection target; keep it across in-place refreshes and clear it on collection/search/view changes. Sequential Next/Previous retain that room within the same collection and use nearest-edge scrolling. Dedicated shuffled-next and Next while shuffle is enabled use the same album-aware top alignment as the artwork click.

Collection exports preserve valid file sizes and raw disc tags. Reconnect uses paths relative to the exported library root across Windows/POSIX paths. Size-less older backups are checked against readable audio metadata and duration before confirmation; a differing, unreadable or unverifiable file cancels the plan. Reconnection preserves imported track/library IDs and playlist references, performs no music moves/deletions, and restores the previous in-memory root/tracks if rescanning fails.

Reconnection refreshes MP3 ratings from the current files so stale backup metadata cannot override newer shared-folder edits. Existing pending legacy ratings and non-MP3 ratings retain their normal preservation rules.

Double-clicking a library, All music or a playlist chooses a random track from that complete collection and seeds its full queue in the current sort/shuffle mode. Artist and search filtering must not restrict this queue.

## Random playback, headings and deletion

After sidebar double-click playback, use the explicit now-playing reveal in the current tab: show the album heading/cover at the top when applicable, with the chosen playing track selected. Do not leave the randomly chosen opening artist or old scroll position in place.

Right-clicking Albums, Covers or Tracks opens one checked Show column headings command. Reuse the shared menu checkmark and close this single-option menu after activation. Shift+X toggles the same saved preference; it is editable in Shortcuts.

Queue commands always appear in this order: Add to play queue, Add to playlist, Create playlist from selection…. Permanent disk deletion is a separated final media action, labelled Delete files permanently…, with a native warning defaulting to Cancel and an explicit irreversible description and file count/paths. Remove empty album/artist directories only with nonrecursive removal, never the library root or nonempty folders. Indexed IDs are resolved and checked in the main process; changed, outside-root and symlink files are rejected before any deletion. Refresh track, playlist and queue references after successful deletion, preserving the viewport and stopping playback if its file was removed. Release the active media handle before disk deletion, restoring it on cancellation.

Shift+Backspace confirms removing the focused library/playlist or the selected tracks/albums/artists from a regular playlist. It never deletes music files; All music and dynamic playlist content cannot be removed with it. Plain Backspace keeps its navigation/deselection behavior. Both new shortcuts use the existing editable shortcut system and preserve custom bindings during migration.

## Test-build corrections and library exclusions

First-launch buttons use the shared dialog-button geometry outside dialogs, but with the main window's text size: 28px height, 12px text/18px line height, 10px horizontal padding, 5px corners. Primary text must remain text-on-accent after keyboard focus restoration; never apply the secondary accent-text hover rule to primary actions. Native cancellation/focus restoration is a required visual regression.

Only the outer context menu owns scrolling, constrained to viewport minus 12px. Its inner action list has no separate height cap. Destination submenus reuse the parent menu's 12px font, 28px rows, padding and line height; no independent 13px override or arbitrary 320px cap. Disk deletion follows file renaming in the editing group. Library settings follows Rename… in library menus.

New installations expand albums by default; existing saved expansion preferences remain unchanged. Empty artists/tracks/albums messages use 600 weight and a final period in every source/view. Playing album titles use the existing accent highlight independently of expansion and navigation selection.

Library settings is a 680px function dialog using the existing 20px edges, 18px heading, 36px aligned rows, 245×28px inputs, 30×17px switches and shared close/footer controls. Exclusions are per-library: exact case-insensitive folder names at any depth, file extensions, wildcard filename patterns (* and ?), and hidden folders. All default empty/off. Save rescans without modifying music files. Excluded existing tracks retain their IDs and regular-playlist references, but leave library/All music/dynamic views; disabling filters restores them. Store/export/import exclusions with the library.

On Windows, perform one native bounds update for queue and mini transitions rather than resizing the OS window every 16ms. Keep the layout frozen until the actual reported content viewport arrives, then commit without extra double-frame delays. macOS retains smooth queue expansion. Report actual content bounds, not predicted window-decoration offsets. Regression checks must compare pane/toolbar/waveform positions before and after a queue round trip.

## Startup actions and stable desktop transitions

Paired first-launch Add library / Import settings buttons have **equal widths and heights**, identical 12px font size, 400 text weight, 20px line height, 10px horizontal padding and 5px radii. Use a shared equal-column grid; do not let label length or primary-action weight change their geometry. Preserve dark text-on-accent for the primary action after Escape/native picker cancellation. Keyboard focus restoration must never add text underlines to buttons, tabs or disclosure labels; use the existing restrained color feedback. These are app styles, not OS styles.

Empty artist, album and track messages use the same muted text token, 600 weight, shared font size and a final period. Do not use primary white for one empty pane and muted gray for another.

Creating a library opens the shared Library settings dialog with a Name row and exclusions before choosing its folder. Apply exclusions during the initial scan; native folder-picker cancellation leaves the dialog available without creating a partial library. Editing existing libraries uses the same rows and controls.

Windows extended queue uses one native resize plus a compositor-driven 180ms panel reveal / 140ms dismissal, respecting reduced motion. Keep the underlying pane/waveform geometry fixed throughout. Use panel-relative close-button coordinates so transforms do not displace it. Retain macOS native expansion. Never remove visual queue motion to hide native resize stutter.

Track requested and actual settled native bounds separately. Preserve the original normal-window target across round trips; do not mistake up to 2px DPI/frame rounding for a deliberate user resize or add that rounding to the next target. Preserve genuine manual resizing. Keep Windows frame styles unchanged in mini mode; reject user resize gestures without toggling the resizable native frame. Never block programmatic resizing during an active window operation, including Windows DPI restoration events. Cache normal decoration extents per display/scaling rather than recalculating minimum sizes from transient frame rounding. Verify at least ten interleaved queue/mini round trips at 100% app zoom and both 100% and 125% Windows display scaling, comparing x/y/width/height and toolbar geometry.

Give Windows transitions one paint opportunity with a 32ms fallback when Chromium throttles requestAnimationFrame. Viewport-settle waits must use the same bounded frame helper; never await a throttled frame indefinitely. Native regression checks wait for the transition to finish before comparing geometry, and choose a viewport that fits the runner's actual scaled desktop.

Minimum-size IPC includes the renderer's actual inner viewport. Use it to measure normal decoration extents when it agrees with native content bounds within 2px; do not let later integer-DIP rounding increase the cached frame or minimum height on the same display.


### Window transitions at fractional display scaling

- Keep the now-playing footer in one permanent layout and layer in normal and mini modes. Reserve its measured height in the sidebar; never change artwork size, spacing, or positioning rules at transition boundaries.
- Freeze the shell at its exact CSS viewport dimensions (`visualViewport`), anchored at the top left. At 130% OS scaling, integer `innerWidth`/`innerHeight` round away fractional pixels and can cause visible shifts.
- Extend only to the right, preserving the original left edge. Use overlay placement when the display has insufficient room to the right. Never move the whole window left to make room.
- Retain canonical CSS content dimensions and the footer baseline across one-pixel native rounding on programmatic round trips; release them on a real user resize.
- On Windows, update only changed native bounds and compensate measured frame/DIP endpoint error with at most two immediate corrective writes while the renderer remains frozen. Reserve the measured queue viewport delta atomically with the frozen root width, rather than assuming every native resize is exactly 224 CSS pixels.
- Reveal the queue from its left edge toward its right edge without translating its text or buttons. Preserve reduced-motion behavior.
- Check player geometry during transitions, not only after settling, at 100%, 125%, and 130% Windows display scaling and 100% app zoom.
- Revealing a playing track prioritizes the track being fully visible. Include the album heading when both fit; never hide a long album's playing track merely to keep its heading at the top.

### Rating playback continuity

Saving a rating must never pause, reload, seek, or replace the playing audio source. Persist MP3 ratings immediately with the verified atomic tag-write path and session undo. Serve each normal playback session from an immutable temporary copy so later range requests keep the same byte offsets after tags change and Windows can replace the original file. Keep at most two playback copies under the active settings folder, remove them on retirement/quit and clean up interrupted sessions on startup. Finish an initial copy before writing that original. Use copy-on-write cloning where supported, and give each new playback a fresh source identity. Keep decoded gapless playback uninterrupted as well.


### Cached startup and empty-pane alignment

Show the saved collection and preferences before disk/cloud-folder reconciliation completes. The first UI load may request the cached snapshot; fresh collection reads and mutations must wait for startup reconciliation so edits cannot race a rescan. Apply the reconciled snapshot in place, preserving search, selections, scroll, queue, playback and appearance. Avoid an immediate duplicate focus-triggered rescan while startup checking is pending. Reveal the window only after preferences and handlers have initialized, never while fallback markup is visible.

Empty artist, album, cover and track states use the same 25px top inset and align their leading edge with their pane toolbar. Headings and explanatory text must share that edge, including first launch, empty playlists and no search results. Do not indent only the heading or only the secondary line. Verify actual text and element alignment in Electron, with column headings both shown and hidden.

Every normal audio range response owns its own read stream and descriptor. Chromium aborts older requests while seeking; cancellation must not close or corrupt later or concurrent responses from the immutable playback copy. Retire copies only after all response streams close. Gapless remains a separate predecoded mode; preserve the user's saved choice and verify both paths.

## Session restoration and window geometry

Restore browsing collection, tab, selections/anchors, album expansion, focus, pane scrolls, queue visibility and playback order. Restore the current song and position paused. Preserve duplicate queue entries and origins; never rebuild a saved queue from a filtered collection. Manual queue clicks and unrelated browsing redraws retain queue scroll. Opening the queue or explicit playback reveals may scroll to the active item.

Horizontal queue extension preserves window x/y position and height while open, including at fractional Windows scaling. Verify open geometry as well as round trips. Startup must not wait for directory checks, stale audio-cache deletion or Last.fm credentials; session restoration must not replay queue entrance animation.

## Native transitions and background tag saves

The document itself never scrolls: constrain html/body to the viewport and clip overflow; scroll only the designated panes/dialog bodies. Check document client width/height during native transitions, not only settled window bounds. Fractional-DPI width changes must preserve native height even at the configured minimum; temporarily relax minimum constraints only while applying a compensating frame correction, then restore them.

Before mini-mode native resizing, suppress all non-player chrome at the compositor level and allow two animation frames for that change to paint. One requestAnimationFrame callback precedes paint and is insufficient. Preserve a short timeout fallback for throttled Windows surfaces; do not use screenshots or replay old interface textures. Keep the suppression until the new viewport and player layout are ready.

After tag-save validation/confirmation, close the editor immediately and show compact background progress through the shared notice. Keep browsing/playback available; serialize conflicting file mutations and wait for writes before exit. Retain undo and all existing write verification. Errors remain visible with a Review action; partial failures cannot silently retry stale tokens. A background completion must not replace the now-playing title if the user has changed tracks.

## Main-window control text and corners

Toolbar controls (view tabs, sort select, icon chips) and first-launch actions use the 12px `--font-normal` text and `--radius` (5px) corners; dialogs keep their 13px text. Chips no longer use a separate 4px radius.

## Play queue selection and focus

Queue rows select on single click (Ctrl/Cmd toggles, Shift extends from the anchor) and play on double click or Enter. Selection is held by queue position, so repeated entries stay distinct; any change to the queue's contents clears it. Delete/Backspace removes selected rows except the playing one, as one undoable queue edit, then selects the next row. Rows and the close button are outside the Tab order. The Focus play queue shortcut (default Shift+P) enters the queue, opening it if closed; while the queue is open it also joins the Left/Right pane cycle between the content pane and the sidebar (Right from the content pane, Left from the sidebar). Entry shows the shared pane-focus pulse over the queue panel and the 2px accent underline on its heading. From the queue, Left returns to the content pane, Right to the sidebar, Tab/Shift+Tab to the content pane; Tab never enters it. Shift+Enter, the context-menu key or Shift+F10 open the row menu with keyboard focus on its first item.

On track changes the queue keeps its scroll position while the playing row stays fully visible; once the row leaves the view it is pinned to the top. A listener who scrolled the queue away from the playing song is not pulled back when the next song starts; starting a new list, opening the queue or Shift+P reveals the playing song again.

Every scroll surface uses the shared `--scrollbar-thumb` / `--scrollbar-thumb-hover` tokens, derived from the background hue and brightness; panes do not set their own scrollbar colours.

## Mini player window

On every platform M swaps to a separate, always-rendered mini window that mirrors the player and forwards clicks and keys to the main window; the main window is never resized. Windows owns the mini window from the main window and swaps opacity; macOS swaps opacity with an independent window (child windows would follow parent moves); Linux swaps by showing/hiding, since its window managers ignore opacity. Moving the mini window moves the full window by the same offset, clamped to the work area.

