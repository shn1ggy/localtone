Localtone 0.116.0 refines playback feedback and fixes early-access update checking.

- Playing markers share the logo's rounded-bar geometry and 2.5-second movement, freezing on pause/buffering. Logo animation can still be disabled independently.
- Sidebar playing markers align with the library/playlist add buttons.
- Sidebar keyboard-focus feedback now covers the complete pane, without padding.
- 0.x early-access builds check published early-access releases as well as stable releases. Drafts and unsupported tags are excluded; versions are compared numerically and compatible downloads still require checksums. Stable 1.x+ builds follow stable releases only.

**Important for 0.115 and earlier:** download this release manually once. Their existing checker queries GitHub's stable-only feed and cannot discover our early-access releases. After installing 0.116, update checking recognizes the early-access feed.

Choose mac-arm64 for Apple Silicon or mac-x64 for Intel. Quit Localtone before replacing the app and keep Localtone-data. Mac bundles are ad-hoc signed and signature-verified in native CI, but are not Developer ID signed or notarized; macOS may require approval in Privacy & Security. All platforms include matching decoder sources and SHA-256 checksums. Real-device playback remains part of early-access testing.
