# Current validation — 0.105

See MAINTENANCE.md for this run’s automated, native rendering, packaging and dependency results. See RELEASE-READINESS.md for unverified target-OS/audio/accessibility gates. Historical entries below describe earlier releases and must not be read as current certification.

---

# v0.90 validation

The About tab uses the common fixed-height Settings layout. Native Electron at 100% zoom checks all six tabs at normal and shorter viewports. Release/update tests cover checksum/version verification, incompatible platforms, unsafe paths, existing destinations, staged-copy failure cleanup, portable/system mode, preserved preferences/playlists and main-process restart. Native Linux ZIP generation and the release/checksum hooks are exercised. Target-OS signing, macOS/Windows packages and online release hosting remain outside this environment. RELEASING.md documents the exact supported local workflow.

# v0.89 validation

`npm run verify` passes lint, runtime formatting and all 243 tests. Native Electron at 100% zoom verifies every Settings tab at normal/short sizes, tag review and scroll preservation, queue feedback/disclosures and extended-queue geometry. A Linux x64 unpacked package builds; standalone launch is blocked by the environment's denied single-instance socket. See MAINTENANCE.md for the complete checklist, performance measurements, dependency findings and explicit limits.

# v0.88 validation

All 71 renderer regressions pass, including the updated 0–300ms first-to-last queue stagger and stronger symmetric cubic-bezier easing. Native Electron at 100% zoom verifies the 650ms movement, revised artist/cover delay spread and the existing glow geometry, saved tag disclosures and full-height queue layout. Transform and opacity remain the only animated properties.

# v0.87 validation

234 automated checks pass. New regressions cover padding both track/total values without changing other tags or audio, idempotent formatting, metadata undo, disclosure persistence through a disk restart, independently collapsed tag sections without losing pending edits, consistent Edit tags-before-Rename ordering, 650ms compositor-only queue feedback and 0–500ms artist staggering.

Native Electron at 100% zoom verifies independently collapsed Tags and Track numbers on reopening, with a 680px editor. Existing 36px rows, 28px controls, 30×17px switches, opaque sticky headers, scroll preservation after save and the 80vh short-window limit still pass. Queue-add feedback verifies artist and cover staggering, track glow geometry, cleanup after completion and no new horizontal scrollbars. The accent glow has a static gradient/shadow and animates only opacity; movement animates only transform. Full-height extended queues reach from y=0 to the window bottom, retain the waveform's original width and have no overlay shadow. Returning to overlay mode restores its bottom clearance and original waveform geometry. Screenshots were inspected.

Native UI checks use deterministic music/database fixtures. GPU frame pacing on the user's Windows/macOS hardware is not measured by the headless renderer; the implementation avoids per-frame raster effects and forced row-layout reads. These are source/UI checks, not signed installer verification.

# v0.86 validation

230 automated checks pass. New disk regressions verify metadata-only tag snapshots, exact multi-file undo/redo, rating undo/redo, outside-edit rejection, snapshot size below the complete MP3, and normal-exit deletion of both new snapshots and a legacy full-file backup without deleting music or collection data. File naming tests cover formulas, punctuation, raw track numbers without totals, reserved/invalid names, collisions, changed files, rollback after a failed collection commit, complete folder contents, retained IDs/playlists, undo/redo and persistence through restart/rescan. Missing totals honor the saved zero-padding switch. Dialog tests cover saved formulas, preview invalidation and undo registration; renderer keyboard tests exercise tag save → Ctrl+Z → Ctrl+Shift+Z and preserved scroll. Packaging and bridge checks include both new main-process modules and the naming renderer module.

Native Electron at 100% zoom verifies a 680px naming window, 28px formula fields, 30×17px switches, preview availability and no horizontal overflow. Add library has a working 28px close action with an 18px SVG. The tag close button actually enters hover and settles to the current accent; an obsolete ID-specific color override was removed. The submenu arrow stays in normal flow with an 8px label gap. Screenshots were inspected and inherited native-checkbox flex sizing was corrected. The integrated tag editor retains its existing row/control/switch geometry and opaque sticky headers. A save in a 360-track expanded list preserves scrollTop 1200; the short 768px viewport keeps the dialog inside 80% height with content scrolling.

Exit cleanup is verified for normal app shutdown; force-killing a process can leave session files until the next normal exit. Real macOS/Windows filesystem locks, permissions and display/audio hardware still require testing on those systems. These are source checks, not signed-installer verification.

# v0.85 validation

223 automated checks pass. New regressions cover combined manual/per-file MusicBrainz patches, unchecked/unavailable tag preservation, multi-file confirmation, retained reviews across albums, explicit matching for unmatched files, loading states, no-results states, search/release retry and stale-response rejection. Real MP3 batch tests verify independent per-file metadata combined with common edits, unchanged titles/genres, preflight rejection before any write, stale tokens, track-number validation, backups, ratings and targeted refresh. The removed lookup IPC is absent from the preload bridge; all renderer imports are served by the production protocol allowlist.

Actual Electron 44.5.1 at 100% zoom verifies a 680px editor, 36px rows, 28px controls, 30×17px switches at the shared right edge and the current cyan accent when enabled. Close buttons retain the shared 28px hit area and 18px SVG. Loading feedback, manual editing, album comparison and the absence of the duplicate context command are checked. A save from a 360-track expanded album list retains scrollTop 1200 after refresh and dialog closure. Sticky track headers stay opaque and remain above scrolling rows. At a 768px viewport the editor remains within 80% height (614.4px), content scrolls and no horizontal overflow occurs. Screenshots were inspected and an inherited grid-placement conflict was corrected before delivery.

Release responses are deterministic fixtures for UI checks. Live MusicBrainz availability and release coverage need testing on the user's desktop; requests retain the existing serialized, cached, timeout-limited service. These checks validate source behavior, not signed Windows/macOS/Linux installers.

# v0.82 validation

212 automated checks pass. New regressions cover Shift+Enter opening without playing a track, arrow navigation, command dismissal, Enter toggles without dismissal, Escape, bidirectional artist wrapping, single-track MusicBrainz context action, zero-padding persistence across lookup openings, collision-safe shortcut migration, and consistent ellipsis rules. The queue animation regression rejects forced row-width reads and verifies transform-only 850 ms keyframes. Native Electron keyboard events verify artist wrap, Shift+Enter/Enter/Escape and persistent toggle menus. Native computed styles confirm an active Web Animation without filter effects. Existing preference alignment/80% height/help checks and MP3 integrity tests remain passing. Frame pacing on the user’s native GPU has not been measured; animated raster filters and forced row reflows were removed as identifiable cold-use costs.

# v0.81 validation

208 automated checks pass. New coverage verifies MusicBrainz query escaping, cached/serialized requests, retry after service throttling, per-disc track totals, partial-album exact-title matching, ambiguous-title rejection, zero-padding preservation, confirmed preview writes, and ignored responses after closing. A real MP3 persistence test verifies track-only writes, rating/other field preservation and stale-token/invalid/duplicate edit rejection. All renderer imports pass the production protocol allowlist test. Actual Electron at 100% zoom measures Settings at 800 px in a 1000 px viewport and identical text center (128 px) for title and tab labels. All five tabs retain their shared first heading/row positions and fixed dialog height; header/help/scroll checks pass. The compact lookup dialog renders without horizontal overflow using deterministic sample API responses. Live MusicBrainz network behavior has not been exercised from this restricted runtime and needs a desktop test. Existing tag-frame preservation and backup tests remain passing.

# v0.80 validation

Three focused settings/Last.fm regression checks pass. Actual Electron at 100% zoom verifies identical heading top (109 px) and first-row top (137 px) across all five tabs, 13 px heading/shortcut text, 36 px first rows, and 28 px Connect Last.fm button height with 13 px regular-weight text and 10 px horizontal padding. All tabs retain the same viewport-relative dialog height. Header, scrolling, help and guide keyboard geometry checks remain passing. Source changes are limited to settings markup and CSS; saved values and connection/keyboard handlers are unchanged.

# v0.79 validation

202 automated checks pass. Regression coverage confirms regular-playlist default reset, configured library default reset, shortcut tag editing across selected artists, repeated album information toggles without dismissal or lost focus, and seek-height checkmark behavior. Actual Electron at 100% zoom confirms all five settings tabs remain 936 px high at a 1000 px viewport, enabled global playback switch color matches the accent, reset/navigation actions align, 36 px rows and 28 px controls, a fixed header, no horizontal overflow and General fitting at normal desktop height. At 768 px viewport height, General scrolls within the fixed dialog and help stays inside the viewport. Queue feedback respects reduced motion. Existing saved preferences and data are untouched.

# v0.78 validation

201 automated checks pass. Added help-controller regressions cover mouse/Enter/Space activation without changing settings, only one popover, repeated-trigger closing, Escape/close focus restoration, outside-click and tab dismissal, narrow-viewport clamping and above-anchor placement. Guide checks retain full field/operator/example content, trap keyboard focus and close the guide before Settings. All prior settings, tag editing, Last.fm, audio, navigation and persistence tests pass. Actual Electron at zoom factor 1 confirms 680 px preferences width, 36 px rows, 28 px controls, fixed header, no horizontal overflow, and General without vertical scrolling. Native key events validate Enter/Space help activation, Escape restoration and modal guide Escape priority. At a 1440×768 viewport General still fits; bottom-row help flips above its trigger and stays onscreen. Full review images include all five tabs, help popover and separate search guide; sample music and app defaults are used rather than the user’s private library. No saved preferences were changed by this UI update.

# v0.77 validation

198 automated checks pass. New checks cover metadata artist grouping without changing physical album identity, filtering and opening modes, new-install versus existing folder defaults, seek-step validation and collision-free shortcut migration, album-list sort order and whole-collection queue creation, clamped keyboard seeking, programmatic cover focus without selection, immediate tag-dialog opening and ignored closed/disposed read results, and dynamic-rule reactivity after rule edits, rating edits and elapsed time. Existing MP3 token/rollback/tag preservation tests still pass after skipping cover extraction during metadata fallback reads. Tag batch reads are bounded to four concurrent files. A synthetic 10,000-track, four-rule benchmark over 50 runs measured 106 ms before versus 58 ms after with identical 2,664 matches; this is a filtering benchmark, not overall app startup speed. Every settings tab was rendered in headless Electron; new General controls remain 28 px in 36 px rows, with fixed header, scrollable content and no horizontal overflow. The reported intermittent cover outline was not reproduced on a native user desktop; focus and pointer selection paths have been hardened.

# v0.76 validation

192 automated checks pass. The new settings regression covers all editable bindings, task grouping, rating disclosure preservation while rebinding, shortcut reset, and clean global-shortcut status. Existing settings persistence, Last.fm, audio-output, keyboard, navigation and dialog tests remain passing. Actual headless Electron renders of every tab were inspected. Geometry checks confirm 28 px general controls, 36 px setting rows, a stationary header with scrolling content and no horizontal overflow. Full-height review captures use sample music and expand the dialog only for screenshots. Native OS audio/device behavior is covered by prior adapters and tests, not by this visual capture.

# v0.75 validation

191 automated checks pass, followed by the focused preference suite after isolating cloned defaults. New checks cover supplied colors/panes/column defaults and preservation of customized settings; album totals/average ratings and seeded random stability; cover sorting/reversal/reshuffling and track-order stability on redraw. Existing default-dependent fixtures now explicitly describe their historical saved layout. Reset appearance checks use the supplied design. Protocol traversal and packaged dependency checks include the shared defaults module. Native visual checks remain outstanding.

# v0.74 validation

188 automated checks pass. Queue tests cover 100-song page boundaries, configurable count, footer removal, bounded final pages and fixed bottom padding. Real-disk settings tests verify the saved count after restart. New lifecycle/race tests cover ignored Last.fm/tag responses after disposal and failed old settings writes preserving newer values. Existing tag, playlist, connection, navigation and protocol traversal checks pass with extracted controllers. Synthetic checks retain 37/40 mounted rows and 1 ms for 25 unchanged queue refreshes. Native desktop visual/audio checks remain outstanding.

# v0.73 validation

183 automated checks pass. New tests cover collapsed album tint state, tag-edit membership across selected albums and Shift+C independent of selection. Dialog controller checks cover guarded backdrop dismissal, captured focus restoration and listener disposal. Tab controller checks keyboard wrapping, retained current tab and cleanup. Existing UI and protocol import traversal tests continue to pass. Native desktop visual/audio verification remains outstanding.

# v0.72 validation

180 automated checks pass. New renderer regressions cover collapsed album Shift-selection and batch expansion, retained heading/track focus and scroll after pane switching, file drops on regular playlist sidebar/content and rejection by dynamic playlists. Real-disk tests cover individual-file indexing without sibling scans, duplicate suppression, playlist order, persistence after restart and dynamic-playlist rejection. The native file path uses Electron webUtils.getPathForFile; native OS drag-and-drop and visual feedback still need desktop verification.

# v0.71 validation

177 automated checks pass: the full existing 174-test suite plus three new browsing-selection model tests. Shift range growth/shrink, additive selection, missing anchors, independent groups and collection reset are covered. Protocol import traversal and existing UI regressions pass with the extracted module. Synthetic 5,000-track checks retain 37/40 mounted rows; 25 unchanged queue refreshes take 2 ms and preserve DOM. Native desktop visual/audio verification remains outstanding.

# v0.70 validation

174 full-suite tests pass. New queue-model tests verify immutable reads, origin alignment, playing-entry preservation, normal-order restoration, Undo and pruning. Existing integration regressions cover filtered/library queues, shuffle, repeated tracks, manual selection, history, gapless advancement and startup import allowlisting. Synthetic benchmarks retain 37/40 mounted rows and 1 ms for 25 unchanged queue refreshes. Native desktop/audio verification remains outstanding.

# v0.69 validation

170 full-suite tests pass. New component tests check late audio-device enumeration after disposal and virtual-table listener/frame cleanup. Existing UI regressions and protocol import traversal exercise extracted window presentation, audio-output settings and virtual tracks. Synthetic benchmarks retain 37/40 mounted track rows and 1 ms for 25 unchanged queue refreshes. Native visual/audio checks remain outstanding. See RENDERER-STRUCTURE.md.

# v0.68 validation

166 full-suite checks pass after cleanup, plus two new bridge-consistency checks (168 distinct checks). Historical album data remains intact across settings saves, rescans and restart; pending ratings survive rescans and explicit track ratings persist to MP3. The obsolete moveTrack-only test was removed with the unused helper; current reorder tests remain. CSS removal targets only nine retired UI IDs. Native desktop verification remains outstanding. See UNUSED-CODE-AUDIT.md.

# v0.67 validation

167 full-suite checks pass, including the added queue DOM/focus regression. New coverage checks queue cache invalidation, renderer/main shortcut parity and packaging of local main-process dependencies. Existing real app-protocol import traversal verifies the four new renderer modules are served. CSS formatting preserves parsed rules; representative computed styles match for 66 elements × 18 properties. Synthetic queue refresh benchmark: 375 ms before / 1 ms after for 25 unchanged refreshes, not a general app speed claim. Native visual/audio verification remains outstanding. See MAINTENANCE.md.

# v0.66 validation

163 checks pass. The snapshot test was replaced by direct mini-switch coverage (no snapshot request, interpolation off, silent P). New album-navigation coverage tests collapsed headings, wrapping, C from album headings and track rows, and toggling all after clearing selection. All 59 renderer tests pass again after final menu changes. Automated DOM/native-window mocks cannot verify desktop painting quality.

# v0.65 validation

162 full-suite tests pass, plus the added snapshot capture regression in a 22-test main-process run (163 distinct checks total). Snapshot lifecycle coverage verifies a visible snapshot before native movement, compositing on restore, cleanup after settling, image CSP permission and silent mini-mode queue behavior. Web search tests require !g. Native compositor smoothness and visual selection feedback have not been verified on a desktop.

# v0.64 validation

161 automated checks pass. New renderer regression covers extending and shrinking album selection, bulk rating all album tracks, opening multiple detail sections, selected-cover queue animation, album menu search, batch track rating, and blank artist-pane focus. Main-process regression checks known-track validation and fixed DuckDuckGo URL construction for all three search kinds. Tests use JSDOM and mocked shell launches; native desktop appearance/browser launch are not visually verified.

# v0.63 validation

159 automated checks pass. New bounds-animation tests cover eased intermediate frames, stable bottom-left anchoring, exact final geometry, queue open/close completion and zero-duration movement. Main-process integration checks serialized mini transitions and rejection of layout minimum changes during movement. Existing renderer, playback, startup, storage and navigation tests remain passing. Geometry uses mocked native windows; this environment cannot verify compositor timing or native animation smoothness on macOS/Windows/Linux.

# v0.62 validation

155 automated checks pass. The previous 0.61 delivery was inspected: package version 0.61.0 and buffered-audio.js were present, but the protocol allowlist omitted the module. The fix adds only that public app module to the allowlist. A new startup regression resolves renderer imports recursively through the actual registered protocol handler and tests that main.cjs/package.json remain blocked. Prior JSDOM tests stripped import declarations and did not detect this failure; the new test closes that coverage gap. Native desktop/device checks remain outstanding.

# v0.61 validation

154 automated checks pass; syntax checks pass. New UI regression covers clearing artist selection while searching, actionable Undo/Redo notification buttons, and no focus pulse after closing Settings by X/backdrop. New gapless tests use real FFmpeg-decoded adjoining waveforms plus an independently simulated audio-clock schedule to check sample coverage and signal identity. Pause/seek/reorder cancellation, simultaneous play requests, repeat-one, gain/output selection, fallback, buffer-limit rejection and preserving time when disabling are covered. Renderer integration confirms promotion without restarting the scheduled next source. Desktop/native-device loopback verification remains outstanding; automated timing tests simulate AudioContext.

# v0.60 validation

148 automated checks pass. Cleanup regression verifies directory links pointing into the program folder, broken relative links, exact backup link targets, preservation of external targets, overlapping-folder refusal, and a real named pipe that blocks cleanup and reports its path. Socket creation is unavailable in this environment; the real named pipe exercises the same special-file refusal branch. Native Windows link permissions and desktop cleanup still need checking.

# v0.59 validation

147 automated checks pass; main/renderer/scanner syntax checks pass. Redo covers queue additions and playlist removals through repeated undo/redo. Settings-export compatibility preserves custom bindings. Real filesystem/main-process tests move a music folder, discover missing files, reconnect, verify IDs/ratings/playlist membership, retain individual missing files on rescan, restore returning IDs, reject a wrong folder and verify restart persistence. Helper tests cover cross-platform paths, traversal refusal and size mismatches.

Gapless verification is a control-flow assessment only: simulated ended events demonstrate next/repeat source loading. Actual sample-continuous output is not implemented or verified; see GAPLESS-ASSESSMENT.md. Desktop appearance, native dialogs, and output listening remain user checks.

# v0.58 validation

142 automated checks pass, plus renderer/main/preload syntax checks. Coverage includes settings-file schema validation, sensitive/machine-specific field exclusion, native-dialog-driven main-process import/export with backup and cancellation, persistence across restart, queue window bounds/edge fallback/restore, immediate tab focus, keyboard Undo of queue additions and playlist removal, and extended queue action/class lifecycle. Existing playback/navigation/storage checks pass. Native desktop resizing/painting still needs verification; window geometry is simulated.

# v0.57 validation

137 checks pass. Updated renderer coverage confirms that the first Down press selects the matching artist and filters tracks. New filesystem tests verify full external-folder backups, active preference preservation, playback-session migration, no-op repeated cleanup, rejection of linked/overlapping paths, inactive-portable rejection, and cleanup only after a requested restart migration. Tests use temporary directories. Native confirmation dialogs and desktop visual layout need desktop checking.

# v0.56 validation

134 automated checks pass. Regression coverage verifies queue scrolling to the active row, artist-pane focus after opening/closing Settings via toolbar pointer events, immediate filtered artist focus from search Down, Escape clearing search, and Backspace restoring the selected cover and scroll position. Existing search, queue, playback, storage and navigation checks remain passing. Geometry is mocked; native desktop appearance needs user verification.

# v0.55 validation

133 automated checks pass. The new renderer regression covers Enter from Artists selecting the first cover, horizontal and vertical grid navigation, queueing the selected album, artwork/title/artist queue rows, opening an album without playback, restoring cover focus after Back, clearing selection, and heading alignment with a separately scrolling queue list. CSS assertions load the application stylesheet; grid geometry is mocked in JSDOM. Actual desktop rendering and scrolling remain to be checked in Electron.

# v0.54 validation

132 automated checks pass. New coverage verifies field/phrase/boolean search, numeric comparisons and ranges, exclusions, malformed input, static result membership through restart, rejection of dynamic/invalid result seeding, saved audio preferences, mocked output switching/disconnect/reconnect, result-action expiry, and album-aware scroll bounds.

Album navigation reveals the whole section if it fits; for taller sections the first and last track reveal their corresponding album boundary while middle tracks use nearest-row scrolling. Now-playing title/artist spacing is symmetric between metadata and controls. Back and Create playlist from results use shared inline-flex button alignment.

Search supports plain words, quoted phrases, artist/album/title/genre/folder/format/albumartist fields, numeric year/rating/track/duration filters, comparisons/ranges, AND/OR/NOT/EXCEPT, parentheses and -term exclusion. Operators are uppercase. Parse errors show inline. Search compilation is cached. Enter captures a results snapshot independently from the queue-search preference. The static playlist uses atomic validated initial track IDs; Dynamic is disabled in its creation dialog. Leaving the view, changing artists/collections, or typing expires the button.

Audio settings use enumerateDevices and HTMLMediaElement.setSinkId, persist device ID/name, and restore the preferred device after reconnection with system-default fallback. Only speaker-selection permission is granted, and only for the local app origin; microphone and unrelated permissions stay denied. Actual device enumeration/routing and native visual spacing require desktop verification; mocked API tests do not establish cross-platform device behavior.

# v0.53 validation

128 automated checks pass. Renderer tests cover first/last track wraparound, Escape clearing selection and moving focus left without altering track scroll, Shift+O restoring folder order, and Ctrl/Cmd+N/L opening the expected creation dialogs. A stale hidden Tracks-table reveal callback is explicitly injected into the album-view test and verified never to run.

Keyboard reveal now scopes tables to the active view and mounts the relevant lazy album before locating a row. Previously the hidden virtual Tracks table could still receive reveal requests while viewing albums, moving the shared scrollbar. Track Escape now updates selection in place instead of rebuilding the list; artist Escape clears the filter and focuses collections. Folder reset also restores ascending direction. Queue nudge is 360ms ease-in-out with reduced-motion support. Plus buttons highlight their symbol, not their background.

Native desktop visual verification remains necessary for animation smoothness and platform scrollbar behavior.

# v0.52 validation

127 checks pass, with all 47 renderer checks rerun after the final artist modifier-selection change. New regression covers X/O cycling and disabled sort behavior, Left/Right wrapping between panes, Enter from Artists, Escape after Select all, selected-track precedence over stale album selection, queue animation attachment and nearest-edge album scrolling. Artist Cmd/Ctrl-click and Escape are checked alongside existing Shift+Arrow ranges.

All context buttons explicitly share left alignment, spacing and typography. Appearance and shortcut reset buttons use the same chip styling. Queue feedback adds a 6px/240ms nudge to affected rows and respects reduced motion. Keyboard reveals use nearest viewport edges; explicit playback navigation retains its separate centering behavior. Modified playback arrows remain available. Shortcut migration preserves existing bindings and chooses an unused alternative if X/O/A is already assigned.

Native appearance and scrolling still need visual verification. The supplied screenshot path was unavailable; the context-menu correction was made from the application styles.

# v0.51 validation

126 automated checks pass. New tests cover the persisted search-queue switch, migration of custom shortcuts when A is already assigned, Shift+Arrow artist and track ranges, Shift+Tab sidebar navigation without opening collections until Enter, Enter-confirmed search playback versus live filtering, and queue shortcut feedback. Existing playback navigation tests cover the single-artist reveal path after range selection is cleared.

A adds the active track/album/artist selection immediately after the current queue item. Queue and indexing notices use the same theme surface, typography and padding, anchored below the queue button (with a mini-player fallback). Playlist move-up/down context actions are removed. Number formatting clears temporary album selection highlights. Artist arrows and backdrop dismissal do not pulse; deliberate Tab switches and confirmed-search focus retain the pulse.

General → Queue only confirmed search results is off by default. When enabled, Enter captures the visible results for starting playback from that result set. Typing again or changing collections clears the confirmation; typing does not rewrite an already playing queue. The existing full-collection behavior remains when disabled. Navigation help is included in Shortcuts.

Native desktop verification remains necessary for exact notice placement and animation appearance.

# v0.50 validation

124 automated checks pass. New renderer regression covers search Enter/Escape focus and its indicator, settings backdrop dismissal, Cmd/Ctrl multi-album selection, MP3 number actions and identical album-information menus in Covers and Albums. Native persistence regression verifies padding, filling missing totals, preserving existing totals and other metadata, untouched unselected files, audio byte preservation and idempotence.

Album tables are measured immediately after attachment and on the following animation frame. Main scrolling no longer uses a negative right margin that can clip the scrollbar; stable scrollbar space and a separate 8px content gap are retained. Native visual checks on macOS/Windows are still needed for exact scrollbar/column geometry and the subtle focus transition.

Number actions only modify MP3 track-number metadata through the existing verified writer and backups. Missing totals use tracks in the same folder/disc, prefer a consistent existing total, and never infer a total below the largest known track number. This cannot establish a missing album's original published total if the local collection is incomplete and has no total tags. Invalid/absent track numbers are left alone. Batch selection supports Cmd/Ctrl-click and Shift-click. Only successfully changed files are refreshed.

Audio output selection was discussed but not added. Packaged file inclusion now also covers the existing global-shortcut and raw tag-frame modules.

# v0.49 validation

122 automated tests pass. New coverage verifies artist/track arrow navigation, Tab pane switching, Enter playback, artist double-click playback, single-click deselection, shortcut reassignment disabling the former binding, persistence validation and replacement of OS playback registrations. Existing folder-reveal expectations now assert file selection.

Mini transitions apply the compact layout before native resizing, keep the player anchored to the lower-left corner during the transition, and prevent overlapping toggles. Album headings expose persisted metadata toggles. Cover scrolling reserves stable gutter space with an additional content gap. Settings uses a compact editable one-binding-per-action list; S is Shuffle and R cycles Repeat. File-manager reveal selects files or corresponding album/artist folders.

Native window transitions, Finder/Explorer selection and visual spacing require desktop verification; automated tests do not establish their appearance on macOS or Windows.

# v0.48 validation

Album tables give automatically sized duration/rating columns compact content widths and let titles use the remaining space; title wrappers explicitly fill their cells. Explicit fixed column choices stay intact.

Mini player dimensions come from the current sidebar/player rather than a fixed 320px preset. Native bounds preserve the lower-left edge; normal and maximized restore bounds are retained separately. Layout minimum messages received in mini mode no longer overwrite the normal minimum. Explicit maximize restore bounds make repeated F toggles reliable. Window regression covers custom x/y/size, pane-width matching, bottom-edge anchoring, repeated F and M from maximized state.

Queue close button copies the toolbar queue button's screen rectangle, including on resize. Number, duration and empty stars share 31.2% lightness (35% below prior 48%). Playlist settings width matches the 480px tag editor; rule controls retain room for labels.

119 existing checks pass, plus a new window-bounds regression; all 14 persistence/window tests pass. Native desktop layout still needs visual verification.

# v0.47 validation

Sidebar divider hit area overlays its boundary instead of reserving an extra 6px on the artwork's right. Mini player uses 320×436 content area, 300px square artwork, normal rating/time row, title/artist and transport sizes, with symmetric 10px edges. Transport hover colors the symbol without a button background. Track number/duration brightness reduced together.

Tag editor follows the attached label/input reference: 28px rounded fields, 6px row gaps, 100px labels, close button and file count in heading, separate Backups/Cancel/Save footer. Existing batch confirmation remains unchanged; no focus outlines.

Settings tab sizing explicitly overrides the square close-button rule. Settings/tag scrolling bodies reserve a stable scrollbar gutter plus 8px content clearance.

119 tests pass; native persistence tests rerun at final mini dimensions. Computed styles verify tab widths, scrollbar padding and mini text visibility. Native desktop visual validation remains unavailable.

# v0.46 validation

Mini mode now bypasses the collection-operation busy gate in both renderer and main process; regression verifies toggling during a pending settings write. Normal collection mutation guards remain intact.

Filled 22px play/pause/previous/next shapes. Track-number and duration cells share muted text color, 18px line height and middle alignment. Noneditable UI text explicitly disables text selection; inputs retain editing selection.

Main settings and tag editor adopt the playlist dialog's 16px padding, 16px headings, 28px action controls, rounded buttons, section separators and solid accent primary actions. Main settings checkboxes are accessible 32×18 switches. Tag value rows retain compact 24px geometry. Computed styles verify padding and switch sizing/alignment.

119 automated checks pass; focused persistence tests also pass after adding the concurrent-operation regression. Native appearance remains for desktop verification.

# v0.45 validation

Volume range no longer suppresses application shortcuts; pointer release returns focus to the app. Full track numbers hydrate old cached file metadata on enabling or startup, using explicit paths only; totals absent in source tags remain absent.

M toggles native 320×356 content-sized mini player (292px square artwork, 14px padding and original transport controls); normal bounds/maximized state restore. Native minimum-size messages cannot enlarge mini mode. Seek height divider supports lock/unlock context menu and a 2px accent hover line; locked divider remains reachable. Toolbar settings/queue order swapped. Text selection disabled except editable fields. Thin hue-aware scrollbars added.

119 automated tests pass including native-window mock restore and volume-focus/seek context-menu regressions. Actual desktop mini-window appearance and scrollbar rendering need user verification.

# v0.44 validation

Playlist settings only: 580px compact dialog with 28px controls, an 80px name-label column and flexible name field, right aligned accessible dynamic switch, equal-width source and match controls, and aligned rule rows. Thin section dividers and a filled theme-accent primary button follow the supplied reference. General settings and tag editing remain unchanged.

42 renderer tests pass, including creation, dynamic filters, empty/date rules and persistence bridge behavior. Computed CSS confirms intended name and toggle grid columns and control sizes. Native desktop visual verification remains unavailable.

# v0.43 validation

Tag edits now scan explicit edited paths rather than walking the full library; unrelated records, playlists and ordering are preserved. Batch edit completion clears progress notices. Scanner stores MP3 trackNumber text verbatim alongside numeric sort metadata. Appearance offers Number only / Number-total; old caches retain numeric fallback until a manual rescan. Full-number display reserves enough column space.

Random-next creates a new shuffled remainder from the unfiltered collection, keeps the previous current song accessible with Previous, and enables Shuffle with repeat disabled. Ordered source remains available when turning shuffle off.

Narrower 12px star spacing; global playback checkbox right aligned; Colors and Albums & tracks separated. Album headings use 14px bold hue-aware text, secondary text stays small and dimmed.

117 checks pass. Native visual verification not available.

# v0.42 validation

Removed legacy tag-label grid spanning which placed values beneath their labels. Explicit name/value cells use columns 1/2 on the same row, with a shared 112px name column and 24px row height; header cells align to the same boundary. Dialog width 420px, compact header and footer spacing. Computed CSS verified both cells on grid row 1 and 24px height. Native browser rendering unavailable (Chromium executable absent).

Track number default and drag minimum now 28px; exact prior defaults migrate, custom layouts remain intact. Track title left padding reduced to 4px; duration right padding 4px, and rating stars have no residual album margin.

116 automated tests pass.

# v0.41 validation

- Starting a track updates playback UI in place, preserving searched album DOM and scrolling.
- Session song, position and collection origin persist in playback-session.json under the active data directory (including portable mode); reopening restores paused playback and the full source queue. Closing before metadata loads retains the saved position.
- Preferences narrowed without reducing 230px control widths.
- Tag editing uses compact name/value rows, mixed-value placeholders and only changed fields; batch writes require a second confirmation click. Existing safe MP3 backups remain enabled.
- 116 automated checks pass, including actual disk restart persistence and renderer scroll/restore/confirmation regressions. Native desktop visual verification remains outstanding.

# Validation — 0.40.0

114 automated tests pass. Renderer, preload and main-process syntax checks pass.

New tests cover selection of multiple tracks, shared/mixed values, checking only chosen fields, explicit extra-tag removal, all-file stale-token preflight, preservation of individual titles, rescanning batch changes, unknown binary frame preservation, artwork/comments/ratings preservation, and ID3v1/APE block removal without changing audio. Existing playback, settings, playlists, storage and Last.fm tests pass.

The tag editor supports plain ID3v2.3 and ID3v2.4 frames. Unsupported tag headers are rejected before writing. Other ID3 frames can be removed individually; identical frame variants are grouped across selected files. Legacy ID3v1 and APE metadata are shown as removable blocks. A standard-field edit removes legacy ID3v1 to prevent old values resurfacing. Original-file backups are retained. All files are preflighted before saving; subsequent filesystem failures report saved and failed files rather than claiming atomic batch success.

Native visual capture previously failed because Electron crashed in this restricted environment. JSDOM interaction tests pass, but this release has not been visually verified in a native desktop window.

Version 0.28 removes toolbar compression breakpoints, fixes tabs to 56px, reserves 600px for the content pane, and sends the combined pane minimum to the native window. The native minimum accounts for window decorations and expands the window when needed. Sidebar width is capped to square artwork height (30% of content height, 23% for short windows, plus sidebar padding). Native window constraint tests cover expansion, lowering the minimum and rejecting invalid dimensions. Native visual verification remains unavailable.

Version 0.29 virtualizes the main track table above 300 tracks. All tracks remain in the selection/playback model and share one continuous scrollbar. Rows around the viewport are mounted with 15 rows of overscan; focused/dragged rows are retained. Small tables and album tables retain their existing rendering. Listener cleanup runs on rebuild and view changes; track reveal can mount offscreen targets.

A synthetic 5,000-track JSDOM benchmark (`node benchmark-render.mjs`) measured 3,128ms before and 271–338ms after in this environment. Live DOM nodes fell from 130,452 to 1,260 at initial render (5,000 track rows versus 31). This measures renderer initialization, not native paint time, file scanning, decoding, or target-machine latency. The regression test checks bounded row counts, reaching the final track, selection across windows, all-track drag payloads, Select All, preserved selection and cleanup when switching views. Real desktop smoothness still needs confirmation.

Version 0.30 adds optional Electron globalShortcut registration for previous/next/random-next, with all-or-none registration, conflict reporting, disabling cleanup and quit cleanup. Local handlers avoid duplicate dispatch while global registration is active. Startup failures appear in Shortcuts settings. Registration has been tested with a fake OS registry; actual OS interception and native color-picker behavior remain unverified here.

New appearance controls include a 0–360 background hue slider and native accent picker with live preview, persisting on change. Dark surface colors use the hue while preserving their lightness hierarchy. Accent RGB tokens drive existing tints. Presets remain available and clear a custom accent. Seekbar height is now numeric (16–200px, initially 32px), resized from an invisible 6px top grip or arrow keys on the separator, with saved locking in Settings and the context menu. Legacy compact/tall controls are removed from the UI. Tests cover preference validation, live previews, save behavior, height drag, locked drag rejection, context settings and shortcut rollback.

Version 0.31 removes the playlist list's 18vh ceiling and lets it fill sidebar space above the player, retaining 14px padding above artwork. Cover hover/focus outlines now draw inside the cover bounds to avoid clipping against the content viewport. Column defaults are #36px (6px horizontal cell padding), flexible title, rating84px (75px for five stars plus padding), duration72px aligned right. Headings default to hidden. Exact previous 42/100/80px layouts migrate; custom layouts and explicit heading choices are retained.

Sidebar and artist separators offer Fix pane width / Enable resizing in their context menu. Locked separators block pointer and keyboard resizing and suppress hover/focus lines; context-menu unlocking stays available. Tests cover locking, unlocking, width changes, exact-preset migration and persistence of locks, colors, seekbar height and lock after main-process restart.

Portable audit: configurePortable redirects userData, sessionData, logs and crashDumps under Localtone-data. Main uses userData for collection.json (all visual/shortcut/column/lock preferences), playback-history.json, covers, waveforms, tag-backups and LastfmService. LastfmService writes encrypted API/session/settings/queued-scrobble data to lastfm.enc there. Existing real-filesystem portable migration and encrypted Last.fm restart tests pass. Toggling storage mode takes effect after restart; OS-encrypted Last.fm credentials may need reauthorization after moving to a different machine/account. Native visual checking remains outstanding.

Version 0.32 adds foreground Q (quit), F (maximize/restore) and P (queue) shortcuts. Text fields, open dialogs/context menus, busy operations, modifier combinations and auto-repeat do not trigger these actions. Native window IPC validates its caller and action. Shuffle and repeat are mutually exclusive in both renderer and persisted settings; old conflicting preferences normalize to shuffle with repeat off.

The tag dialog now has compact label/value/action rows. Keep preserves values, typing chooses Set, and Clear explicitly blanks a field. Mixed fields show a placeholder with original values in a hover tooltip. The embedded-tag section and per-field status/expansion controls are removed. Backups remain accessible in the footer. Tests cover Keep reverting a pending mixed-field edit, Clear, batch submission, shortcut exclusions, queue toggling, shuffle/repeat exclusivity, and native maximize toggling. Native visual verification remains outstanding.

Version 0.33 restores the complete ordered playback queue and locates the current track when disabling shuffle (directly or by selecting repeat). Random-next during shuffle no longer overwrites the saved normal order. A regression test uses 600 tracks in both library and playlist contexts, starts shuffled at 584, disables shuffle/enables repeat, then checks next=585 and previous=584.

Column visibility, order, width, fixed/flexible and alignment are now shared across views. The existing Tracks layout becomes the shared layout on migration; subsequent writes synchronize all compatibility fields. Tests now verify sharing across playlist/album/track views and restart.

Only the playlist section scrolls in the sidebar. The native window minimum height has a 740px content baseline and is raised from measured sidebar content to reserve five playlist rows alongside library navigation and the player. Window decoration height is included. Existing width constraints remain. Native visual/layout verification still needs a desktop environment.

Version 0.34 defers album heading/table construction outside the viewport plus 600px overscan for lists exceeding 30 albums, using IntersectionObserver with lightweight height placeholders. Mounted albums remain available until the next render. Individual album tables above 300 tracks also use row virtualization. Select All, range selection and drag payloads use the full expanded-album model, independent of mounted DOM. Player navigation explicitly mounts its target album/track. Observers and table listeners are disconnected on view rebuild. Stable album row geometry reduces placeholder shifts.

Synthetic JSDOM album benchmark: 5,000 tracks across 500 expanded albums rendered in 3,841ms before versus 275ms after; initial live nodes 146,411 versus 1,784. Run BENCH_ALBUMS=1 node benchmark-render.mjs. The benchmark uses a mock intersection observer; it measures initial DOM construction, not native scrolling, painting or cover decoding. A regression test simulates an offscreen album entering range and verifies all 5,000 selected tracks remain in drag payloads.

Appearance adds live background saturation (0–100%, default12%) and dark-mode brightness (0–30, default11). Surface lightness offsets preserve the existing hierarchy; values persist through the standard settings path. Validation and live-preview tests pass. Native appearance/scrolling verification remains outstanding.

Version 0.35 uses the normal interface font token for search, reduces sidebar navigation rows from 32px to 28px, updates the five-row height allowance, and creates track thumbnails only in the main Tracks table. Album lists and albums opened from Covers omit per-track artwork. The existing 111 tests and renderer syntax check pass. Native visual verification remains outstanding.

Version 0.36 reduces track row height from 38px to 22px in all table views, retains font sizes, uses 18px Track-view thumbnails and 20px star controls. Virtual row calculations and deferred album placeholder heights use the same 22px geometry. Appearance range inputs now have explicit non-native styling, 4px tracks and 10px thumbs with a -3px WebKit offset, correcting vertical centering. Existing 111 tests pass; native visual verification remains outstanding.

Version 0.37 uses 32px main Tracks rows and 24px album rows (including albums opened from Covers), with matching virtualization/placeholder geometry. Number-column defaults shrink from 36px to 32px with 4px side padding; drag and validation minimums now support this width. Exact previous default layouts migrate, custom widths remain. Reset appearance restores theme/colors, cover size, headings, columns, pane widths/locks and seekbar appearance/height/lock. The new reset test verifies that playback, portable mode, global shortcuts and connections are not changed. Previous full 111-test suite and updated 39-test renderer suite pass. Native visual verification remains outstanding.

Version 0.38 is CSS-only: track titles use the same normal font token as artist names; the sidebar brand uses the same 10px toolbar gap as artist search, and All music matches the first artist row height (32px). Library/playlist rows retain 28px height. Verified selector cascade and shared top padding/header heights; no new behavior tests needed. Native visual verification remains outstanding.

Version 0.39 UI pass: track/artist names share normal type; All music and first artist row share 32px centered rows and top offsets. Album covers align to the number-column left inset, album-header play buttons are removed, and volume gains 8px width plus 5px queue-side space. Focus outlines are suppressed globally; cover hover and active separator affordances remain. Focused search placeholders become transparent.

Settings tabs move beside the title and share main-tab geometry/active colors. Section headings use stronger weight and dividers. Checkboxes align with the start of the 230px control column. Accent presets are removed from the UI (old stored themes still supply initial accents). Playlist-rule selects use measured longest-option widths, tighter gaps and flexible value fields.

S and Ctrl/Cmd+P toggle Settings; E edits selected MP3 tags, falling back to the playing MP3 if nothing is selected. Plain-letter shortcuts ignore editing fields. Cover-grid scroll is saved on album entry and restored on Back or album-header return. Media Session nexttrack/previoustrack handlers and playback metadata/state support physical media keys, with key-event fallback when Media Session is unavailable. Tests verify these actions through mocks; physical keyboard routing still needs target-system verification. Native visual checking remains outstanding.

Version 0.40 follows the supplied foobar screenshot with a default 128px square album cover beside the title and track table. Clicking the cover or heading toggles expansion; collapsed covers use 48px. Appearance → Album layout offers Compact to restore the previous layout, and Reset appearance selects Cover beside tracks. Lazy album placeholder geometry uses the new dimensions. All table rows now use 28px, with matching virtual row calculations.

Album toggle captures the section's viewport position, rebuilds and mounts the replacement, then corrects scrollTop by the position delta. Native scroll anchoring is disabled on the content scroller to avoid competing corrections. Seek pointer handling sends focus to the body; range-native navigation keys are prevented without stopping app shortcut propagation. All music is a persistent final child of Libraries, preserved through sidebar rebuilds.

New regression coverage simulates DOM rebuilding resetting scrollTop, verifies collapse/expand anchoring, confirms seek interaction permits P and prevents native range arrow behavior, checks All music ordering and switches the album-layout preference. Existing 114 tests pass. Native rendering of the new layout still requires desktop checking.


## v0.83 — startup and review-dialog consistency

- Full suite: 213 tests passed; the added silent queue-fallback regression passed with all 9 renderer-component tests (214 total).
- Actual Electron at 100% zoom: review switches 30 × 17px, rows 36px, selects 28px, labels 13px, right-aligned switches, no horizontal overflow.
- Long review table: at scrollTop 80px, sticky heading remains exactly at the scroll container's top; hit testing returns the heading, and its background is opaque RGB(34,36,37), with z-index 2.
- Settings tab alignment, fixed 80vh height, compact controls and short-viewport help remain correct. Native context-menu keyboard and queue-feedback checks pass.
- Startup readiness: real Electron window remains invisible before renderer readiness and visible afterward, with SVG icons and saved cyan accent applied. This headless check uses offscreen rendering and bypasses the unavailable single-instance socket; platform compositor/frame timing still requires testing on the user's desktop.
- Source archive built in a temporary file, atomically finalized and CRC-checked before saving.


## v0.84 — missing searches and playlist selection

- 218 automated tests pass, including metadata placeholders/raw track tags, boolean search combinations, dynamic-expression validation/persistence through restart, single-artist E selection, Plus picker, submenu keyboard navigation, selection playlist creation and close SVG consistency.
- Actual Electron at 100% zoom verifies compact dynamic Search expression mode, its standalone guide, regular-playlist-only picker, 28px close buttons / 18px glyphs and no dialog overflow.
- Destination submenu near the right edge flips to the left, remains within viewport and is not clipped by the parent menu (hit test confirms visible contents).
- Existing Settings alignment/height, lookup switches and opaque scrolling headings, keyboard menu toggles and queue animation checks remain passing.
- v0.84 did not include full metadata comparison; v0.85 replaces its separate lookup with the integrated editor described above.
