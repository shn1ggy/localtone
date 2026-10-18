Localtone 0.117.0 restores the original playback marker design while retaining animated feedback.

- Playing markers use their original three bars and 10 × 12 px footprint. Height/y movement follows the logo's 2.5-second rhythm, preserves the bar shapes, and freezes when playback pauses or buffers.
- Library and playlist names retain left alignment when their playing marker appears. The marker remains aligned with the sidebar add buttons.
- Update discovery is unchanged from 0.116: early-access builds recognize published early-access updates, with compatible archive and SHA-256 checks.

**Updating from 0.116:** Check for updates should offer 0.117. Download the verified archive, extract it, and use Prepare update… if you want Localtone to copy portable settings/data into a new folder. Downloading does not install or restart the app automatically. For replacing an app in place, quit it first and keep Localtone-data.

Versions 0.115 and earlier still need a manual download once. Choose mac-arm64 for Apple Silicon or mac-x64 for Intel. Mac packages are ad-hoc signed and checked in native CI; they are not Developer ID signed or notarized. Windows and Linux packages, matching decoder source archives, Localtone source and checksums are included.
