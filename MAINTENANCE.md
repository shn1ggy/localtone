# Maintenance report — Localtone 0.105

Completed 11 October 2026. See RELEASE-READINESS.md for the public-release decision, prioritized gates, UX findings, keyboard acceptance tasks, positioning and roadmap. Earlier reports below are historical; their test counts and dependency snapshots are not current.

## Results

- Baseline: 300 tests passed. Final behavioral suite: 303 tests passed, with lint and runtime formatting clean.
- Confirmed/fixed: portable migration omitted browsing sessions; source archives could include portable migration backups; benchmark harness lacked dialog factories; documented Node minimum disagreed with current jsdom; first-run Covers hid Add folder; shortcut editor lost focus on save/cancel/reset; search/app shortcuts intercepted IME composition; playlist width disagreed with the design contract; guide-link padding was overridden; rule-width measurement used the wrong font size; empty-state text had a hard-coded greenish color.
- Native Electron at 100% zoom: all six Settings tabs at 1440×1000, 1180×760 and 1100×600 stress height. Width 680px, height 80vh, matching header/tab centers and content starts, no measured horizontal overflow. Function dialogs, mixed tag form, rule editor, rename, duplicate review and first-run empty views inspected. Shared keyboard focus feedback uses underline/icon/border, no outline.
- General legitimately scrolls at normal height because it has outgrown its row budget. This remains a documented information-architecture task, not a false claim that it fits.
- Linux x64 unpacked package builds with installed Electron 44.5.1 and the matching local Electron distribution. Packaged version, required runtime files, app.asar/decoder manifest hashes verified. Standalone launch aborts in this environment because Chromium's single-instance socket is prohibited; no platform-launch pass is claimed.
- npm production audit: 0 reported vulnerabilities. Full audit: 8 moderate, 0 high/critical, all in the build dependency chain from sprintf-js (GHSA-hp3w-g68c-fv3c). A normal `npm audit fix --dry-run --ignore-scripts` proposed 0 changes and retained the 8 reports. No forced override was applied.
- npm outdated reports Electron 44.7.0 available versus installed 44.5.1, music-metadata 12.1.0 versus 11.16.1, and Prettier 3.9.10 versus 3.9.9. Retained the tested lockfile/runtime baseline in this maintenance build; review runtime/binary updates before a public release. npm audit does not cover FFmpeg/Chromium binary safety.
- Synthetic 5,000-track benchmark smoke measurements: tracks 203ms / 37 mounted rows / 1,896 nodes; albums+queue 252ms / 40 track rows / 3,117 nodes. Twenty-five unchanged queue refreshes took 1ms and retained row identity. Single-run host measurements, not a performance improvement claim or target-machine prediction.
- GitHub CI and manual unsigned native-build workflows prepared; YAML syntax parsed. They have not run on GitHub and do not publish or use signing credentials. Added ignore rules, issue templates, Dependabot and contribution/privacy/security/licensing docs.
- Source packager now keeps only project root folders/files, explicit project dotfiles and no data/migration backups or signing-key formats. It is not a general-purpose secret scanner. Source ZIP CRC/version/manifest are verified during delivery.

## Review boundaries

Read renderer/IPC/permissions and packaging paths, persistence/migration, search/rules, dialog/focus/shortcut handling, shared styles/defaults and existing module tests. Existing tests cover MP3/audio preservation, transactions/undo, partial failures, stale files, quiet refresh, duplicate Trash, queue/state restore and portable settings. This is a broad maintenance pass, not proof that every branch is bug-free.

No real personal library was scanned, edited or published. Real audio listening, screen-reader testing, authenticated online services, Windows/macOS UI/file locks, Bluetooth routing, platform signing and actual GitHub runners remain separate release gates. Do not label the app stable or fully accessible until those have evidence.

---

# Maintenance report — Localtone 0.89

Completed 10 October 2026. This was one end-to-end maintenance pass, not a sequence of pending approval stages. Existing preferences and music were not reset or edited; validation used isolated fixtures.

## Audit checklist and outcome

| Area checked | Work and evidence | Outcome |
| --- | --- | --- |
| Architecture and entry points | Read runtime/module ownership, preload/IPC contracts, worker/protocol imports and packaging lists | Updated ownership guide; current runtime files are included in the package |
| Unused code and styles | Reference searches, lint, generated UI review, before/after Electron geometry | Removed unused state/helpers and 40 retired CSS selector branches; preserved live functional selectors and compatibility paths |
| Readability and repeatability | Format runtime JS/CJS/MJS, CSS and HTML; add shared formatter/linter config and verify command | Lint and formatting pass; renderer formatter differences reviewed as equivalent logical grouping/property spelling |
| Collection persistence and portable storage | Disk-backed restart, settings export/import, migration/cleanup and malformed-data regressions | Pass; user data was not touched |
| MP3 tags, ratings and undo/redo | File/audio preservation, raw track numbers, stale-file rejection, batch writes, metadata snapshots and shutdown cleanup | Pass; tag editor now uses shared playback-position-preserving release path |
| File/folder naming | Preview validation, collisions, transaction rollback, stable IDs, undo/redo and stale preview response | Pass; editing while preview is pending no longer leaves Preview disabled |
| Search and dynamic playlists | Parser/operators, missing metadata, rules/query equivalence, persistence and conversion | Pass; consistent folder metadata projection and 2,000-character query limit |
| Settings failure behavior | Optimistic writes, overlapping failures and newer choices | Fixed rollback to last confirmed value; new regression coverage |
| Last.fm lifecycle | State refresh races, failed enable, queued requests, persistence and shutdown | Fixed failed toggle display and stopped starting more requests after close; user-agent version now follows package version |
| Audio lifecycle | Existing playback/queue/gapless scheduler regressions; listener and late-decode disposal | Pass; native listeners detach and disposed buffers cannot be repopulated by late work |
| Queue and browsing | Shuffle/repeat transitions, origins, filtering, paging, selection/navigation and queue mutations | Regression suite passes; unchanged queue refresh preserves mounted rows |
| Window behavior | Mini/extended-queue serialization, bounds restoration, reduced motion and startup readiness | Automated/native fixture checks pass; target-OS hardware verification remains necessary |
| UI/design consistency | Five Settings tabs at 1440×1000 and 1180×760, 100% Electron zoom; tag review at short height | 680px width, 80vh fixed Settings height, aligned title/tabs, preserved geometry, no horizontal overflow |
| Tag review and queue visuals | Native tag comparison/save, sticky headers, switch accent, disclosure persistence, glow/stagger, full-height extended queue | Pass with fixtures; scroll preserved and waveform width stable |
| Dependency health | Lockfile, outdated packages, full and production-only npm audits | Production: 0 reported advisories. Build chain: 8 moderate reports, 0 high/critical; see below |
| Packaging | Linux x64 unpacked build with Electron 44.5.1, packaged runtime asset checks, source ZIP validation | Build succeeds. Standalone binary launch is blocked by this environment's socket restriction; not claimed as passed |
| Documentation | README, DESIGN, module ownership, unused-code record, validation and changelog | Current instructions consolidated; historical release detail stays in changelog |

## Concrete fixes

1. Reuse one natural-sort collator instead of constructing locale comparisons repeatedly.
2. Evaluate dynamic-playlist membership for the playing track directly, rather than filtering the whole library for every dynamic playlist.
3. Use the same folder-derived metadata when displaying tracks, remembering dynamic-playlist playback and converting a dynamic playlist to a regular playlist. Folder expressions now retain their matches through conversion.
4. Preserve the active track's playback position through tag-editor writes using the existing shared release helper.
5. Re-enable naming previews when inputs change while an earlier preview is pending; ignore the stale result.
6. Roll back failed optimistic preferences to the last confirmed value, including when consecutive writes both fail.
7. Disable the Last.fm enable control during requests and restore its actual saved value after failure.
8. Stop launching additional queued scrobble requests after shutdown begins; preserve unsent entries.
9. Remove disposed audio listeners and discard late decoded results.
10. Bound ordinary search expressions consistently with dynamic-playlist search input.
11. Remove verified dead state/styles and introduce repeatable formatting/lint checks.

## Measured performance

Same-host synthetic fixtures; median of three runs for these comparisons. Sorting output was checked against v0.88, not assumed equivalent.

| Operation | v0.88 | v0.89 |
| --- | ---: | ---: |
| Folder sort, 5,000 tracks | 162.98 ms | 11.58 ms |
| Artist sort, 5,000 tracks | 118.05 ms | 4.10 ms |
| Remember membership across 50 dynamic playlists | 4.77 ms | 0.06 ms |

The final 5,000-track renderer smoke benchmark mounts 37 rows / 1,737 DOM nodes and completes in approximately 226 ms on this host. Baseline startup was approximately 223 ms, so no overall startup-speed improvement is claimed. The baseline album/queue probe mounted 40 track rows; 25 unchanged queue refreshes took approximately 1 ms and retained row identity. These measurements do not predict audio latency, disk scanning speed or animation smoothness on another computer.

## Automated and native verification

`npm run verify` passes: lint, format check and **243 tests**, with no failed or skipped tests. Nine new checks cover the fixes above. Existing tests cover storage restarts, protocol allowlists, tag/audio identity, renaming rollback, queue state, navigation, settings, portable data and window transitions.

Native Electron fixture checks at 100% zoom confirm:

- All Settings tabs remain 680×800 at 1440×1000 and 680×608 at 1180×760; header/tab centers match and no horizontal overflow appears.
- Before/after Settings control rectangles and font sizes match; the cleanup preserves the established design.
- Tag editing keeps 36px rows, 28px controls, 30×17px switches and a 680px window. Sticky headers remain opaque. Save preserves the main pane's scroll position.
- Queue feedback retains 650ms per element and a 300ms first-to-last stagger; only transform/opacity animate. Glow layers are cleaned up and do not introduce horizontal overflow.
- Extended queue uses the whole window height without stretching the waveform; overlay mode retains its own geometry.

The Linux unpacked package builds successfully. Direct standalone launch aborts before app startup because this execution environment denies the OS socket used by Chromium's single-instance mechanism. No security restriction was bypassed. Native fixture rendering and packaged-asset checks are separate evidence, not a claim that this standalone launch passed.

## Dependencies and remaining limits

Production-only npm audit reports no known advisories as of this run. The full audit reports eight moderate entries along the build-tool dependency chain, originating in `sprintf-js` ≤1.1.3 (GHSA-hp3w-g68c-fv3c). The advisory lists no patched version; a normal audit fix offers no change. A forced, unverified major override was not applied. Recheck when electron-builder's transitive dependencies are updated.

Reference: https://github.com/advisories/GHSA-hp3w-g68c-fv3c

ESLint, Prettier and their globals package were added at current versions with the lockfile retained. Electron remains on the previously tested 44.5.1; the music-metadata major upgrade was not mixed into this maintenance release.

Not available here: physical audio-device listening, real gapless transitions on the user's hardware, live authenticated Last.fm/MusicBrainz sessions, Windows/macOS file-lock and global-key behavior, code signing, installer notarization, or GPU frame-time measurement. Automated fixtures cover their local logic but cannot replace those checks. The large renderer and layered stylesheet remain candidates for measured future restructuring; removing all historical compatibility paths would risk existing collections.

## Suggested next priorities

1. **Release reliability:** target-OS smoke tests, signed installers, visible version information and a repeatable release checklist. This reduces wrong-download/update uncertainty.
2. **Real audio validation:** a small reference library of gapless albums and mixed formats, device switching and sleep/resume tests on Windows/macOS/Linux.
3. **Incremental indexing:** measure file scanning separately, then consider a cancellable background rescan and folder-change detection without changing browsing position.
4. **Targeted architecture work:** extract additional renderer responsibilities only around tested ownership boundaries; avoid a large rewrite that changes mature keyboard/selection behavior.
5. **Usability polish from real use:** collect slow actions or reproducible navigation cases before adding more features. The current local-player workflow is already broad.

No further approval is required to complete this maintenance release. The items above are future priorities, not unfinished stages of this pass.
