# Maintenance note — 0.105

Lint/reference checks still pass. No speculative bulk deletion was performed. Historical CSS overrides and the large renderer remain a measured refactoring task; DESIGN.md now specifies the shared contracts and state matrix required before removing an override. The broken benchmark import wiring was repaired. See MAINTENANCE.md for current verification; older counts below are historical.

---

# Unused-code audit — 0.89

Runtime lint reports no unused variables, undefined identifiers, unreachable statements, duplicate object keys or duplicate arguments under the checked configuration. Unused callback arguments are intentionally allowed. Reference searches and the current rendering paths were checked before deleting candidates.

Removed unused drag/waveform state, locals, an obsolete tag helper and unused icon arguments. Removed 40 CSS selector branches for retired UI, including obsolete album play/rating controls, old pagination, collection headers and tag extras. Shared functional selectors are retained. No broad cascade reorder was performed.

Retained compatibility migrations, old persisted keys, callback/worker entry points and reachable fallback APIs. Static checks cannot prove every branch reachable or every CSS selector used under all user data.

The earlier removal record below remains useful historical context; current architecture and results are in RENDERER-STRUCTURE.md and MAINTENANCE.md.

---

# Unused-code audit — 0.68

## Scope

Reviewed named runtime functions and imports, preload methods and IPC registrations, main-process scan/rating/tag paths, renderer settings handlers, and CSS IDs against current static and generated UI. Reference searches produced candidates; removal decisions were checked against callers and regression coverage. This is a focused repository audit, not a proof that every unreachable JavaScript branch has been found.

## Removed

| Item | Evidence / replacement |
| --- | --- |
| `rateAlbum` bridge and `album-rating` IPC handler | Album-level ratings were removed from the UI. Rating selected albums uses existing per-track file ratings. No renderer caller remained. |
| `export-ratings` IPC handler | Its settings control and preload entry had already been removed. The endpoint had only a historical test caller. |
| `moveTrack` export and import | No shipped caller. Current playlist/group drag-and-drop and queue reordering use their existing active implementations, covered by interaction/UI tests. |
| Settings branches for `defaultView` and `theme` | These checked keys never present in their enclosing list of controls. Existing view migration and color settings remain. |
| 30 CSS selector branches | Nine retired IDs: cover-size-control, artist-display, artist-sort-control, column-settings, artist-sort, artist-direction, collection-tools, tag-extra-details, tag-extra-fields. Mixed rules keep their active selectors. |

## Intentionally retained

- Existing `albumRatings` data: preserved as opaque historical collection data; no new album-rating records are initialized or exposed for editing.
- `pendingRatings` and rating-storage migration: protects old database-only ratings from being overwritten by rescans. Explicit per-track rating writes still move that track's value into file metadata.
- `importLibrary(..., preserveRatings)`: used when reconnecting moved libraries.
- Old view/theme/waveform preference keys: accepted for settings compatibility and migrations; removing their controls does not authorize discarding old settings.
- Single-track tag bridge methods: reachable fallback paths in the current tag editor.
- Track-total refresh: repairs old indexed entries lacking raw track-number tags.
- Playback, scanner, waveform and gapless entry points: callbacks and IPC/worker registrations count as callers.

## Verification

166 full-suite checks pass after removal, plus two new bridge audit checks (168 distinct checks). One obsolete helper test was removed together with its implementation. Legacy persistence tests now seed historical data directly instead of creating it through the retired endpoint. They verify album-rating preservation, pending-rating protection during rescan, explicit file writes and fresh-import recovery.

New checks require every exposed preload method to appear in shipped renderer source and every invoked/sent channel to have a main registration. These are structural guardrails, not a substitute for runtime tests.

## Next stage

The broader renderer split remains separate: playback, browsing/selection and settings still share renderer-owned mutable state. This release removes confirmed obsolete code without changing those ownership boundaries or the current design. Native desktop verification remains outstanding.
