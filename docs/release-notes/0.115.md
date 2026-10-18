Localtone 0.115.0 fixes the macOS packaging problem reported in 0.114.0.

- Mac app bundles now have explicit ad-hoc signatures, with the entitlements Electron requires. This replaces the incomplete signatures inherited from the unmodified Electron download.
- The source-built decoder is signed before its provenance and checksums are recorded. Packaging preserves that signature and verifies the resulting release hashes.
- Native Mac CI extracts the actual ZIP and verifies the full app signature, decoder signature, release hashes, and packaged Electron/decoder execution before uploading it.
- Music files, settings, UI and keyboard behavior are unchanged.

**Downloads:** choose mac-arm64 for Apple Silicon or mac-x64 for Intel. Extract the ZIP and replace the old app while it is closed. Keep any Localtone-data folder.

These remain **early-access builds without an Apple Developer ID certificate or notarization**. Ad-hoc signing verifies bundle integrity but does not identify a trusted developer to macOS. Gatekeeper can still require approval in System Settings → Privacy & Security. A Mac CI launch test is not a substitute for testing playback and settings on your Mac.

Windows and Linux downloads, matching FFmpeg source archives, Localtone source, SHA256SUMS.txt and checksums.json are also included. Production update checks continue to follow stable releases.
