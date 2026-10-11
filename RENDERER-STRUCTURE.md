# Runtime ownership — 0.105

| Area | Owner |
| --- | --- |
| Native lifecycle, trusted IPC, serialized database mutations | `main.cjs`, `preload.cjs` |
| Indexing, local media and waveform/decoded audio work | `scanner.mjs`, `media.cjs`, `waveform.cjs`, `gapless-decoder.cjs` |
| Validated preferences, portable migration and settings transfer | `preferences.cjs`, `portable.cjs`, `settings-transfer.cjs` |
| Safe MP3 writes, metadata snapshots, rename transactions | `tags.cjs`, `tag-history.cjs`, `file-naming.cjs` |
| Duplicate review and safe Trash removal | `duplicates.cjs`, `app/duplicates-dialog.js` |
| Session restore, quiet refresh and cache lifecycle | `browsing-session.cjs`, `startup-refresh.cjs`, `cache-cleanup.cjs` |
| Release manifests and update preparation | `release.cjs`, `update-preparation.cjs`, `build/release.mjs`, `build/release-hooks.cjs` |
| Collection rules and search | `app/core.js`, `app/rules/search.js`, `app/rules/playlist-rules.js` |
| Browsing models, selection and virtual rows | `app/browse.js`, `app/browse-selection.js`, `app/virtual-tracks.js` |
| Queue state, bounded queue pages, window presentation | `app/playback-queue.js`, `app/queue-view.js`, `app/window-presentation.js` |
| Audio buffer lifecycle and listening/scrobble tracking | `app/buffered-audio.js`, `app/listen.js`, `lastfm.cjs` |
| Dialog focus, preferences tabs, contextual help | `app/dialog-coordinator.js`, `app/settings-tabs.js`, `app/settings-help.js` |
| Tag, naming, playlist, connection and audio forms | Their corresponding `app/*-editor.js`, `*-dialog.js`, `*-settings.js` controllers |
| Optimistic preference writes and rollback | `app/settings-writes.js` |
| Icons, menu order, shortcuts and appearance defaults | `app/icons.js`, `app/context-menu.js`, `app/shortcuts.js`, `app/design-defaults.js` |
| Main view rendering and cross-component action coordination | `app/renderer.js` |

The renderer remains large. Splitting it further is worthwhile only around a tested state boundary; this maintenance pass does not move working behavior merely to reduce a line count. Runtime sources are consistently formatted and linted. Derived folder metadata uses the same projection for snapshots, dynamic-playlist membership and conversion to manual playlists.

Preference writes use the serialized native write lane. Per-key revisions protect newer edits, while confirmed values protect rollback when multiple optimistic writes fail. Controllers reject stale asynchronous responses. Tag saves use the same playback-release/position-preservation helper as other file writes. Audio disposal detaches native listeners and discards late decode results.
