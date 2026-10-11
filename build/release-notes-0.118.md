Localtone 0.118.0 fixes update redirects and refines pane focus and dynamic playlists.

- Update checks/downloads use Node networking inside Electron, avoiding Electron’s manual-redirect cancellation. Trusted HTTPS redirect checks, cancellation, bounded downloads and SHA-256 verification remain in place. Verified inside Electron by downloading and checking the complete published Mac archive.
- Artist/track focus pulses span the entire window height, including the waveform, with no content-padding gaps. Track pulses stop at a visible queue; sidebar behavior is preserved.
- Dynamic playlist rules include Disc, with numeric and empty/nonempty comparisons. Missing disc tags do not become Disc 1 through the display fallback.
- Dynamic playlists use registered user libraries only. Finder/Explorer imports into regular playlists no longer leak through their internal Imported files containers into rule/search results.

**Updating from 0.116/0.117:** Download this release manually once, because those versions can fail with “Redirect was cancelled” before offering an update. Choose mac-arm64 for Apple Silicon or mac-x64 for Intel. Extract, then use Prepare update… to copy portable settings/data to a new folder, or quit and replace the app while preserving Localtone-data. Downloads do not install or restart the app automatically.

Mac packages are ad-hoc signed and checked in native CI; they are not Developer ID signed or notarized. Windows/Linux downloads, matching decoder sources, application source and SHA-256 checksums are included.
