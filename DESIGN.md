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
| Standard dropdown | 245px wide; numeric input 72px |
| Button width | Fit text; icon-only close/action 28px square |
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
- Keep keyboard focus perceptible without adding outlines: dialog text actions and disclosure labels underline on `:focus-visible`; close icons use the accent; switch borders brighten without implying a changed value. Text fields retain the existing subtle focused surface. This is keyboard-only feedback; mouse hover rules are unchanged. Color changes alone are not sufficient for selection: retain position, tint and selected-state indicators.
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

Pane-focus pulses are noninteractive overlays inset to each pane's actual content edges: artist search right edge and browsing toolbar left edge. Do not pulse the inter-pane padding. A playlist submenu preview does not capture Up/Down/Home/End until focus enters its items with Right; these keys close the preview and continue the parent menu. Clicking now-playing artwork clears the artist filter while preserving the active browsing tab and playing collection. Extended queue closing keeps the queue width reservation until the frozen layout is released; commit both class changes in the same task to prevent a one-frame waveform stretch.

Confirmed search snapshots persist across tabs and artist filters; clear them only when the search changes/is cancelled or the collection changes. Sidebar focus feedback is positioned inside the sidebar. Use one restrained three-bar playback marker for source collections and playing tracks; selection retains its own surface. Album title emphasis uses accent text, never text outlines, on hover or album/contained-track selection. General → Library has Ignore discs when renumbering, off by default; on assigns continuous natural folder-order numbers across discs while preserving disc tags and valid existing totals.

Album-list/detail titles select the album and all contained tracks; only artwork clicks expand/collapse. C and Shift+C retain keyboard expansion. Title selection preserves scrolling and uses accent text.
