# Current release status — 17 October 2026

Localtone 0.131.0 is an early-access release. The public GitHub repository, GPL-3.0-or-later license, native builds for Apple Silicon Mac, Intel Mac, Windows x64 and Linux x64, matching FFmpeg sources/notices, checksums and GitHub-hosted updates are established. 384 tests pass on Windows, macOS and Linux. Native Windows UI checks cover 100%, 125% and 130% display scaling, including queue/mini transitions and minimum-height behavior. The project owner approved the tested candidates for publication.

Remaining priorities are broader independent hardware/audio testing, signing/notarization, accessibility and newcomer testing, clearer public documentation, and playlist interoperability. Passing automated checks does not establish every device, Linux desktop or screen-reader workflow. No broad stable-release claim is made.

**Historical audit follows.** The older statements below about choosing a license, creating a repository, unpublished downloads and old shortcuts describe earlier development states. Use the current README, release notes and this status section for the present release; the older audit remains background for the roadmap.

---

> Published follow-up (0.114): the first public early-access release is available on GitHub for Apple Silicon Mac, Intel Mac, Windows x64 and Linux x64. All four native builds, archived app manifests, matching decoder sources, dependency notices and uploaded asset hashes were verified. 321 app tests pass across the three operating systems; publishing safeguards have additional tests. These packages are unsigned/not notarized, and physical Mac/Windows hardware validation remains outstanding. Stable in-app checks intentionally exclude this pre-release.

> Current follow-up (0.114): the repository is public. Native releases now require pinned-source FFmpeg builds and include platform-specific matching source archives; previous prebuilt decoder candidates must not be published. Native rebuilding and early-access release verification are in progress. Hardware/signing validation remains open.

> Current follow-up (0.113): GPL-3.0-or-later and the private shn1ggy/localtone repository are established. Source CI has passed on all three operating systems. Public release assets, native hardware/signing validation and FFmpeg source redistribution review remain open. About supports public stable-release checks and verified downloads, with manual extraction/preparation. Private multi-platform release candidates are now built and combined automatically; see RELEASING.md. The older audit below remains historical.

> Follow-up in 0.107: the owner selected GPL-3.0-or-later. LICENSE, the project licensing notice, contribution terms and package metadata now reflect it. The historical audit below predates this decision; third-party notices/source-distribution review and the other release gates remain outstanding.

> Follow-up in 0.106: native processor checks, packaged dependency/notices evidence, archive checksum verification and the first GitHub pre-release checklist are implemented. The licensing, signing, repository/contact and real-hardware gates below remain open. The maintenance measurements below describe 0.105.

# Localtone: public-release review and roadmap

Reviewed 11 October 2026 (Europe/Berlin), source 0.105.0. This is a source, automated-test and native-rendering audit. It is not an independent security certification or a claim that physical Windows/macOS/Linux audio tests passed.

## Decision

**Feature-complete enough to recruit early testers; not ready to call a stable 1.0 for the general public.** The next milestone should be a small, clearly labelled alpha/early-access release after licensing and native-package gates are closed. Stop adding large features during that stabilization period.

A GitHub repository is an appropriate home for code, issues, discussions and release downloads. Ordinary listeners need a downloadable app for their OS, clear installation instructions and screenshots. The source ZIP is a developer download, not the primary user download. No repository was created and nothing was publicly published during this audit.

## Work completed in this maintenance run

| Finding | Change | Evidence |
| --- | --- | --- |
| Source packager could include Localtone-data.previous-* migration backups | Exclude data/backups, signing-key formats and arbitrary top-level data; retain only deliberate project dotfiles | Temporary private-data fixture cannot enter source inventory |
| Switching portable/system storage omitted browsing-session.json | Include saved browsing session in both migration directions | Disk-backed migration regression |
| npm run benchmark crashed because a new dialog factory was absent from its harness | Add missing factories; exercise both benchmark modes in CI | Both modes run again |
| README advertised Node versions unsupported by the installed jsdom | Correct engines/docs and add .nvmrc | Compared actual installed dependency engine declarations |
| First-run Add folder was inside Tracks-only markup | Shared empty state now visible in Albums/Covers/Tracks | Renderer regression plus actual Electron screenshots/click |
| Shortcut editing lost focus after rebuilding controls | Restore the edited/reset control without scrolling; give binding buttons action names | Save/cancel/reset regression |
| Input composition could confirm search/navigate prematurely | Ignore app/search shortcut handling while IME composition is active | IME Enter regression |
| Preferences used inconsistent switch semantics; keyboard focus was too subtle | Native switch roles, keyboard-only underline/close-icon/switch-border cues without outlines | Native rendering and computed styles |
| Playlist dialog was 480px despite the 680px design contract | Restore shared width and preserve compact controls | Native dialog review |
| General links inherited 10px padding from a broad button rule | Correct selector specificity, retaining zero-padding guide links | Computed Last.fm link padding |
| Dynamic rule width probe measured 12px text for 13px controls | Match its rendered font size | Native rule review |
| Empty-state copy had a hard-coded greenish color | Use shared neutral muted token and align empty-pane text | Native first-run review |
| README still described removed optional confirmed-search queue behavior | Correct documentation: search never narrows the normal queue | Compared actual playback behavior/design contract |
| GitHub/project support files missing | Prepare CI, manual unsigned build workflow, Dependabot, bug/feature templates, ignore rules, contribution/privacy/security/licensing docs | YAML parsed locally; GitHub execution pending |

Existing preferences were preserved. No user music or saved library was used for the tests or modified.

## Gates before an open-source public alpha

| Priority | Required outcome | Current status / how to close |
| --- | --- | --- |
| P0 | Explicit project license and redistribution plan | **Open.** Choose a license. Recommended discussion: GPL-3.0-or-later if distributed improvements should stay open. Audit actual FFmpeg binaries, corresponding source and all packaged notices. See LICENSING.md. |
| P0 | Repository and public contact | **Open.** Create the repository, add repository/homepage/issues metadata and a real MusicBrainz User-Agent contact. Enable private security reporting. |
| P0 | Clean checkout reproduces source + native packages | **Partly verified.** Linux unpacked build/assets/checksums pass here. Run prepared CI on a fresh GitHub checkout; run manual builds for each advertised OS/architecture. Do not carry node_modules across systems. |
| P0 | Real launch/install/update tests | **Open.** macOS Apple Silicon/Intel, Windows x64, Linux supported desktops, portable and system data. Test a clean account as well as upgrades. The local Linux standalone launch was blocked by the sandbox's Chromium singleton socket; native fixture rendering is separate evidence. |
| P0 | Safe music operations | **Automated coverage passes; tester sign-off needed.** Edit/rate/rename/Trash only disposable copies first; verify other tags/audio, conflicts, offline folders, sync races and undo. |
| P0 | Audio/device behavior | **Open on real hardware.** Reference gapless album, compressed formats, pause/seek, Bluetooth→speakers and reverse, device removal, sleep/wake, media/global keys and long tracks. |
| P1 | Honest download/trust experience | Sign/notarize macOS and sign Windows for a polished public release. If early test builds are unsigned, label them and document OS restrictions accurately. Never call unsigned/checksummed builds signed. |
| P1 | Dependency/binary baseline | Production npm audit: zero reported advisories; full build graph: eight moderate reports, zero high/critical. Review available Electron 44.7.0 versus installed 44.5.1 and the actual FFmpeg build. npm audit does not audit those binaries. |
| P1 | Usability with new people | Recruit 5–10 testers with different library habits; complete the task protocol below. |
| P1 | Public documentation/screenshots | Quick start, supported/tested formats and systems, known limitations, changelog, privacy/network behavior and support route. Use synthetic/cleared artwork for promotional assets. |

The license, repository identity/contact and signing credentials are owner decisions or external setup. They are not things a source-code cleanup can truthfully mark complete.

## Is the UX too personal?

The core is broadly useful: local collections, album art, responsive browsing, keyboard selection, file ratings, dynamic searches, tag review and waveform seeking. Those are not exclusive to one person's collection. Album-artist grouping already works without Nico's folder naming convention, while folder grouping remains available.

The current product is deliberately an enthusiast player. Its more personal defaults are hidden column headings, locked pane widths, very dim track metadata, compact rows, dark-only color customization, portable storage by default, pane-oriented Tab navigation and single-letter commands (especially Q to quit). Keep existing users' choices intact, but test fresh-install defaults independently before public beta.

Recommendations:

- Give the first session one obvious Add folder action and an optional short keyboard guide. The hidden first-run action was fixed here; avoid a mandatory tour.
- Make collection actions discoverable without requiring knowledge of right-click/F2/E. A compact command palette is a strong next feature, searchable by plain action names and showing current bindings.
- Expose a clear route to columns when headers are hidden. A new user cannot infer that right-click customization exists.
- Offer a readable-contrast/density/text-size profile, preserving the current compact look as a choice. Dim duration/number text is aesthetic, but not comfortably readable for everyone.
- Do not make newcomers create Last.fm API credentials as the only polished public path indefinitely. Investigate a maintained app registration and supported authentication flow; a distributed desktop app cannot keep an embedded shared secret confidential.
- Explain portable writable-folder requirements. Installing in protected locations is not the same as placing an app in a writable music folder; assess system storage as a fresh-install option, without changing existing users.

## Design audit findings and next layout work

Native Electron checked at 100% zoom, 1440×1000, 1180×760 and stress height 1100×600. All six Settings tabs keep width 680px and height 80vh; header/tab centers and first content edges align. No horizontal overflow was measured. Standard text controls remain 28px; the shared 13px body, 18px headings, 30×17 switches and 28/18px close button/glyph contract is retained. Function dialogs and fresh empty views were inspected too.

General now scrolls even at the 1000px test height. That is an information-architecture issue: extra maintenance/storage options have outgrown the original four groups. Do not solve it with smaller text or compressed rows. Proposed next settings structure: a left category rail for General, Library & files, Appearance, Audio, Connections, Shortcuts and About, with the same shared rows and fixed window shell. Alternatively keep six tabs and move infrequent maintenance into one Library tools dialog. Prototype this before changing it; neither option was imposed here.

Remaining UI checks before a broad beta:

- 125/150/200% display scaling and small laptop usable heights; the normal window currently enforces at least 1044×740 before platform decorations/content minimum adjustments.
- Readability with very dark/bright custom colors and long multilingual tags, paths and playlist names.
- Screen-reader semantics for virtual track rows, cover selection, live errors and keyboard-only menu state. Button labels alone do not establish accessibility.
- Higher contrast for dim track numbers/durations/stars. Inactive controls must still be understandable.
- Long-operation cancellation/progress for scans, duplicate hashing and large metadata reviews.
- Consider warning before dismissing a dialog with unsaved manual tag changes. Preserve easy dismissal for ordinary settings; do not block every close.

The stylesheet is still about 8,000 lines with historical overrides. It is not safe to delete a selector just because its original purpose is old. Next structural cleanup should move verified shared tokens/dialog rules into one layer, comparing computed geometry and screenshots while removing each superseded rule. The main renderer is still about 5,200 lines; extract keyboard/menu/browsing responsibilities only behind behavior tests. Neither size alone is a release blocker, but both raise regression cost.

## Keyboard verdict

**Strong for a user who knows the scheme; not yet demonstrated fully accessible or obvious to a first-time user.** Automated coverage includes pane Tab/Shift+Tab/arrows, wraparound, range selection, Escape, search confirmation, editable shortcuts, rating/tag/queue actions, persistent toggle menus and submenu Left/Right. This pass fixes shortcut-editor focus restoration and composition handling.

Important limits: ordinary Tab is intentionally used for pane cycling, so the toolbar is not a conventional linear tab sequence. Volume/seek native keys were intentionally suppressed in favor of app navigation; some toolbar-only actions still lack a straightforward discoverable keyboard route. Add a documented toolbar-focus mode (for example F6) or command palette, then test it with people who did not help design it. Do not advertise every control as keyboard accessible yet. Physical media keys/global shortcuts need Windows/macOS/Linux verification; VoiceOver and NVDA require separate testing.

Keyboard acceptance tasks:

1. Start from an empty app; create a library and find a known track without a mouse.
2. Search; Down enters and selects the first matching artist; Enter focuses tracks; Escape clears/search exits correctly.
3. Navigate all three views, select ranges across discs/collapsed albums, edit the intended selection and cancel safely.
4. Open Shift+Enter menu, use arrows, keep toggles open, open/close an empty playlist submenu and return to the original item.
5. Queue selected tracks/albums, toggle shuffle/repeat, skip, and verify the active queue occurrence is revealed.
6. Change a shortcut, cancel a change, reset shortcuts, and continue tabbing from the same control.
7. Operate Settings/help/guide dialogs without losing focus or changing settings accidentally.
8. Repeat with an international keyboard and IME; repeat with a screen reader and high-DPI display before accessibility claims.

## Positioning and competition

Suggested product line: **“A compact, keyboard-driven music player for people who own their music.”** Supporting proof: album-oriented browsing, waveform seeking, file-based ratings, editable tags and expressive playlists in one restrained desktop interface. “Designed for Windows, macOS and Linux” is defensible; “fully tested on all platforms”, “bit-perfect” and “a complete foobar2000 replacement” are not yet demonstrated.

| Existing option | Officially presented strength | Localtone's potential distinction |
| --- | --- | --- |
| foobar2000 | Mature configurable player, Windows/macOS; Windows version can run through Wine | A consistent opinionated workflow with integrated covers/waveform/tag review; avoid claims of feature parity |
| Strawberry | Established local collection manager across desktop platforms | A more compact interface and selection/keyboard workflow, if new-user testing supports that claim |
| fooyin | Customizable local player with waveform, tags and configurable keys | Closest conceptual competitor; fixed cohesive layout may appeal to people who prefer not to assemble widgets |
| Feishin | Modern client for self-hosted music servers | Localtone opens local folders without requiring a media server |

This is qualitative positioning, not market-size research or evidence that users will switch. The realistic first audience is local-library enthusiasts, Bandcamp/CD collectors and keyboard-focused listeners with a few thousand tracks. Trying to satisfy every casual streaming listener would dilute the product.

## Discovery and launch plan

1. **Start with a credible GitHub page:** one strong screenshot, a 20–40-second keyboard/waveform demo, three concrete benefits, a prominent OS download table, honest early-access limitations and links to changelog/issues. Add relevant repository topics such as music-player, local-music, audio-player, electron, waveform and keyboard-navigation.
2. **Recruit 5–10 testers before advertising broadly:** include at least a compilation-heavy library, FLAC collection, external drive, badly tagged folders and a high-DPI/small-screen user. Record failures/tasks, not just “looks nice”.
3. **Launch a public pre-release:** publish built artifacts, checksum files and clear source/download distinctions. Keep bug reports actionable with the included templates. Use Discussions for workflow questions; one public roadmap with Now/Next/Later.
4. **Share useful demonstrations:** show selecting albums entirely by keyboard, finding missing tags, reviewing MusicBrainz proposals, and creating a rating-based playlist. Explain the practical result, not only the animation.
5. **Reach relevant communities:** local-music/self-hosted/open-source communities and platform app communities, respecting each one's posting rules. Ask for specific testing feedback and disclose that you built it. Do not mass-post or buy ads before retention/installation works.
6. **Later distribution:** after stable signed builds, evaluate Homebrew, winget and a Linux package channel such as Flathub/AppImage distribution. Each adds packaging/support obligations; do not submit untested builds just for reach.

GitHub helps credibility, collaboration and downloads; it is not a discovery strategy by itself. A small landing page can follow a working release. Check repository/domain/name availability and possible name conflicts before investing in branding. No name-clearance claim was made in this audit.

Useful early measures: successful installs, time to first song, completion of key tasks, repeat use after a week, reproducible crashes/data-loss reports, and resolved bugs. Do not add invasive analytics just to get numbers; opt-in tester feedback is enough initially.

## Roadmap, in order

| Stage | Work | Why / acceptance criterion |
| --- | --- | --- |
| Now: release foundation | License/notices/FFmpeg provenance, repository/contact, native CI/builds, hardware smoke tests, readable docs | Someone else can install, trust and safely use the exact release |
| Next: newcomer and keyboard usability | Command palette/toolbar focus, first-run guidance, discoverable column settings, readable contrast/text sizing, settings grouping | Five new testers complete core tasks unaided |
| Next: library interoperability | M3U/M3U8 import/export with relative paths; broader metadata/rating writes for FLAC/Vorbis/MP4 | People can bring existing collections/playlists and leave without losing structure; support matrix is truthful |
| Next: listening quality | ReplayGain/volume normalization, long-track streaming decode, real gapless/device regression fixtures | Consistent listening volume and reliable transitions without whole-track memory limits |
| Later: performance/architecture | Measured 20k/50k/100k library cases, cancellable indexing/duplicate scans, tested CSS/renderer extraction | Demonstrated bottlenecks improve without changing selection/queue behavior |
| Later, demand-led | Lyrics, additional metadata tools, optional folder artwork sources, translations | Add only when repeated tester use supports the work |
| Defer | YouTube/Spotify streaming, ad blocking, plugin platform, social accounts/mobile sync | High maintenance cost and a different product scope |

ReplayGain and playlist interoperability are more important public-player additions than further tag-number microfeatures. A mature local player need not ship every one of these before alpha; it should state what it supports.

## Tester sign-off sheet

For each advertised OS/CPU, record release SHA-256, OS version, tester/date, pass/fail and issue link for: clean install; restart/session restore; folder import; search/selection; tag edit/undo; rename/conflict/undo; duplicate Trash; offline/resynced library; manual/dynamic playlists; shuffle/repeat/duplicate queue entries; seek/volume; gapless and long files; Bluetooth/output fallback; sleep/wake; media/global keys; mini/extended queue; settings export/import; portable/system migration; update/rollback; display scaling; keyboard-only flow. A blank cell is untested, not passed.

## External references checked 11 October 2026

- GitHub Releases: https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- GitHub licensing: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository
- License options: https://choosealicense.com/
- Electron security: https://www.electronjs.org/docs/latest/tutorial/security
- FFmpeg package/provenance: https://github.com/eugeneware/ffmpeg-static and https://ffmpeg.org/legal.html
- MusicBrainz identity/rate limits: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- Product references: https://www.foobar2000.org/ ; https://www.strawberrymusicplayer.org/ ; https://fooyin.org/ ; https://github.com/jeffvli/feishin
- GitHub CI: https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs
