# Contributing to Localtone

Localtone is a public, early-access project at https://github.com/shn1ggy/localtone. Localtone-owned code and original assets are licensed under GPL-3.0-or-later; see LICENSE and LICENSING.md. Third-party components retain their own applicable licenses.

Use Node 24 LTS (24.15+, tested with .nvmrc), run `npm ci`, then `npm start`. Use an isolated folder and disposable copies of music for development: ratings and tag/naming operations modify real files. Never commit Localtone-data, settings exports, credentials, signing files or copyrighted music.

Run `npm run format`, `npm run verify`, `npm run benchmark`, and the album/queue benchmark (`BENCH_ALBUMS=1 BENCH_QUEUE=1 npm run benchmark` on a POSIX shell). Windows PowerShell: set `$env:BENCH_ALBUMS='1'` and `$env:BENCH_QUEUE='1'` first. Timing varies; benchmark failures matter, arbitrary timing thresholds do not.

Read AGENTS.md, DESIGN.md and RENDERER-STRUCTURE.md. Keep changes focused. Preserve preference migrations, track IDs, queue occurrences, selection and scrolling. Test behavior at the owning module boundary; for UI changes also inspect actual Electron at 100% zoom at normal and short heights. Do not replace native controls with unlabeled clickable elements or add permanent help walls.

A useful bug report includes Settings → About version/OS/architecture, steps, expected/actual behavior, view/grouping/sort, relevant shortcuts and audio format. Remove private paths/usernames. Never upload your app-data folder, credentials, a full music collection or crash dumps without inspecting them.

Before accepting a change involving writes, verify metadata/audio preservation, stale-file refusal, partial failures and undo. Before accepting playback changes, verify paused state, queue duplicates, shuffle/repeat, seeking, next/previous and restart. Hardware/platform sign-off remains separate from automated checks.

Maintainers: review dependency updates and licenses, enable private security reporting on GitHub, pin reviewed action SHAs before adding privileged release jobs, and use protected signing environments. CI must never receive signing credentials on pull requests. A passing workflow does not authorize publication.

## Contribution license

Contributions to Localtone-owned code are made under GPL-3.0-or-later. Preserve existing copyright and third-party notices. Identify the origin and license of any external code or assets you propose to add.
