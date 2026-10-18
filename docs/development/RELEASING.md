# Building and updating Localtone

## Build a desktop app

Install Node.js 24 LTS (24.15+, tested on 24.19.0) and run `npm ci` in the source folder. Before native packaging, build the pinned source decoder using [build/ffmpeg/README.md](../../build/ffmpeg/README.md). Install the listed toolchain and run the build and finalize commands. Packaging intentionally rejects the development decoder installed by npm. On the target OS:

| System  | Command                 | Result                                     |
| ------- | ----------------------- | ------------------------------------------ |
| macOS   | `npm run release:mac`   | ZIP containing Localtone.app               |
| Windows | `npm run release:win`   | App-folder ZIP and standalone portable EXE |
| Linux   | `npm run release:linux` | App-folder ZIP and AppImage                |

These commands run lint, format and tests first. Output appears in `dist` with the version, OS and processor in its filename. The first packaging run may download Electron/build tools. To select a processor, append `-- --arm64` or `-- --x64`. Build on the target OS to use its native tooling. `npm run dist:dir` creates an unpacked desktop app for local smoke checks. `npm run release:source` creates the source ZIP with its release manifest and SHA-256 file.

**Mac users:** extract the ZIP and open Localtone.app. For portable mode, put it in a writable folder such as a Localtone folder under your home directory. Localtone-data lives next to the .app, outside the bundle. Building for Apple Silicon uses arm64; Intel uses x64.

**Windows users:** extract the complete ZIP and launch Localtone.exe, or use the portable EXE. Keep the executable and Localtone-data together in a writable folder. No Node.js is needed for a desktop release.

**Linux users:** make the AppImage executable and open it, or extract the ZIP and run localtone. AppImage data lives beside the original AppImage, not inside its mounted image.

## About

Settings → About reports `app.getVersion()`, source/desktop build, OS/processor, actual storage mode, data path and runtime versions. Open folder opens the active data directory. The version is independent of filenames and screenshots.

## Prepare a portable update

Starting with 0.90:

1. Obtain a trusted newer release and extract it into a separate writable folder. Do not open it first: it must not already contain Localtone-data.
2. In the current app, open Settings → About → Prepare update….
3. Select the extracted app folder; on Mac, select Localtone.app itself. Confirm after verification.
4. Preparation pauses playback and copies a snapshot of persistent data. Once ready, quit the old app and open the new one promptly.
5. Keep the old folder as recovery until the new version works. Switching back means opening that old version with its retained data snapshot.

The assistant verifies release identity/checksums, stable version order and native platform/architecture. It copies libraries/playlists/preferences, playback position/history, encrypted Last.fm data, settings backups, covers/waveforms and retained external-data backups. Browser sessions, logs, crash dumps and session tag undo are not transferred. Last.fm credentials remain specific to the same OS account/keychain; this is not a cross-system credential migration tool. Session undo ends with the old app.

Data is staged and verified before it is installed. A failed copy removes staging; the original remains untouched. Existing destination data, links/special files or overlapping paths are rejected. Finish pending storage-mode changes by restarting first. With system app-data mode, the new release receives a mode marker and continues using the existing OS app-data location.

Source release folders are accepted, but install dependencies with `npm ci` before starting them. This assistant is for extracted folders/Mac bundles; a standalone portable EXE or AppImage placed beside the same Localtone-data already retains data when that executable is replaced while closed. Keep the old executable for recovery. The assistant does not unpack archives, download releases, silently launch or overwrite an installed executable.

## Release checks and trust

Native builds contain `localtone-release.json` in resources with app.asar and FFmpeg checksums; source manifests cover shipped source files. Native release hooks also write `dist/checksums.json`. Check archive integrity, native launch and About's displayed version before distribution. Manifests/checksums catch incomplete or mixed files; they are **not** signatures. Use trusted release files.

Native build commands do not publish automatically. Settings → About → Check for updates follows stable GitHub Releases and verifies the matching desktop download. Early-access pre-releases are downloaded from the Releases page. Installation remains manual, with Prepare update… for portable data transfer; the app does not overwrite itself or restart automatically. Test update/rollback with both portable and system storage before promoting a release to stable.

## Signing and platform validation

Unsigned local builds are useful for testing. For a smooth public installation experience, use Developer ID signing and notarization on macOS and Authenticode signing on Windows. Unsigned early-access builds can be distributed with clear platform instructions, but they trigger trust warnings and may be blocked by OS policies; checksums do not remove those warnings. Credentials are supplied through the builder's supported environment/keychain configuration, never committed to source. They cannot be generated from this project.

Official references:

- https://www.electron.build/docs/targets/
- https://www.electron.build/nsis/
- https://www.electron.build/code-signing-mac
- https://www.electron.build/code-signing-win
- https://www.electronjs.org/docs/latest/tutorial/updates

For every target, check launch, About/version, data location, first-run/restart, playback, portable updates and storage migration. This environment can verify the Linux build and native fixture UI; it cannot sign or test real Windows/macOS installations.

## GitHub preparation added in 0.105

The source archive includes `.github`, `.gitignore`, `.gitattributes` and `.nvmrc`. The Verify workflow runs checks and both benchmark modes on Linux, macOS and Windows, with a separate production dependency audit. The manually triggered Build unsigned test packages workflow packages on the native runner and retains artifacts for 14 days. It never publishes to Releases or uses signing secrets. Verify has run on GitHub; inspect [Actions](https://github.com/shn1ggy/localtone/actions) for the latest commit's results. Native packaging has now passed on Apple Silicon Mac, Intel Mac, Windows x64 and Linux x64 for the first early-access release. They use current official action major tags; Dependabot tracks updates. Pin reviewed commit SHAs before adding signing credentials or publishing jobs.

Create a repository with the contents of Localtone at its root (not a containing Localtone folder), review the ignored-file inventory, retain the agreed GPL-3.0-or-later license and fill in project contact metadata. Run CI on the exact intended commit. Inspect every job rather than assuming a green Linux result covers the other operating systems. Fix any platform-specific path/permission/symlink failures before publishing.

Build each architecture in a fresh native environment. `ffmpeg-static` installs a host-specific binary; changing electron-builder's target architecture does not by itself prove the bundled decoder matches. Prefer native arm64 and x64 runners and verify the packaged FFmpeg executable. Universal Mac packaging needs explicit FFmpeg architecture handling; it is not validated.

Use a GitHub **pre-release** flag for early access with the existing numeric version, such as v0.105.0. Do not add a `-beta` version suffix yet: the local update assistant currently accepts three-part numeric versions only. Attach actual built app archives and checksums; GitHub's automatically generated Source code ZIP is not an installer. Keep the source release clearly labelled. Follow the sign-off checklist in RELEASE-READINESS.md.

Source packaging excludes portable folders and their migration backups, signing-key formats and arbitrary top-level data folders. Only explicit project dotfiles are included. Still inspect the inventory before publishing: ignore rules are not a secret scanner, and data deliberately copied into app/build/test/docs can be included. Never attach Localtone-data, settings exports, credentials or user music to a GitHub release.

## Build verification added in 0.106

Native packaging now inspects the actual application and FFmpeg executable headers (ELF, Windows PE, or macOS Mach-O). A processor mismatch fails the build instead of creating an archive that cannot decode music. Packaging also runs the bundled FFmpeg with `-version` on the native target and records its actual configuration and SHA-256 hash. Use a fresh dependency installation on the target OS **and processor**. Cross-processor builds are intentionally rejected when the decoder cannot be verified on the build host. Universal builds require both executable slices, including FFmpeg; they remain unvalidated.

Each desktop package includes these files in `resources`, or `Localtone.app/Contents/Resources`:

- `localtone-build-audit.json`: actual binary processors/hashes, FFmpeg version/configuration, Electron version and dependency inventory from the packaged app, including nested dependencies.
- `THIRD-PARTY-NOTICES.txt`: license and notice text present in those packaged dependencies, matching installed-package notices omitted by the packager, plus FFmpeg's accompanying notice/readme when available.
- `localtone-release.json`: integrity manifest, including the generated audit and notices.

The audit is recorded during afterPack, before any code signing. Its executable hashes describe that stage; final downloadable archives have separate checksums. Before adding signed distributions, validate the integrity-manifest handling of signed FFmpeg binaries: signing may change their bytes after the embedded checksums have been generated. Do not modify a signed macOS bundle afterward to update a manifest, because that can invalidate its signature. Signed packaging is not validated by the unsigned workflow.

The inventory does not resolve missing notices, license compatibility, or FFmpeg corresponding-source obligations automatically. Review it before public distribution. Electron/Chromium notices are separate files supplied by Electron; retain them in the complete app folder/bundle. Do not distribute an executable alone from an extracted Windows/Linux app-folder ZIP.

Native archive builds write both `checksums.json` (with file sizes) and `SHA256SUMS.txt` in `dist`. The unsigned GitHub build workflow checks the completed archives before uploading them. It does not publish a GitHub release. The source archive keeps its matching `.zip.sha256` file.

To verify all downloads with the source tools, put the checksum file next to the downloaded archives and run:

```sh
npm run release:verify-downloads -- /path/to/checksums.json
```

The command fails for missing, truncated, altered or duplicate files, unsafe filenames and symbolic links. It only checks files listed in the supplied checksum manifest. SHA-256 detects corruption; it does not authenticate an untrusted download. Obtain the checksums and app from the maintained release page.

Without Node.js, compare one downloaded archive's result with its entry in `SHA256SUMS.txt`:

| System             | Command                                                          |
| ------------------ | ---------------------------------------------------------------- |
| macOS              | `shasum -a 256 "Localtone-0.106.0-mac-arm64.zip"`                |
| Linux              | `sha256sum "Localtone-0.106.0-linux-x64.AppImage"`               |
| Windows PowerShell | `Get-FileHash "Localtone-0.106.0-win-x64.zip" -Algorithm SHA256` |

Use the exact filename shown on the release page; these names are examples. Windows hashes may display uppercase letters; case does not change the hash value.

## First GitHub pre-release: owner checklist

1. Keep the agreed GPL-3.0-or-later license and review LICENSING.md. Fill in the repository URL and maintained contact details once the repository exists.
2. Put the project contents at the repository root and push them without any user data. Run Verify on the exact commit intended for release.
3. Run Build unsigned test packages manually. Download each successful workflow artifact and extract it. Those workflow containers are not the app downloads: they contain the actual app ZIP/EXE/AppImage and checksum files.
4. On real hardware, check each OS/processor package against the release sign-off checklist. Verify playback/seek, Bluetooth output switching, shortcuts, tag edits/undo, restart restoration, portable/system storage, update and rollback. Record tested OS versions and processors honestly.
5. Resolve licensing/source-distribution obligations and review packaged notices. For public signing/notarization, configure private credentials separately and pin workflow actions before enabling privileged jobs.
6. Create a draft GitHub release tagged with the numeric version, marked pre-release. Attach the actual tested app archives, checksums and separately labelled source ZIP. State clearly whether the apps are unsigned. Publish only after reviewing the draft and assets.

The repository now exists. No published release, signing identity or cross-platform hardware sign-off has been created by these source changes.

## Selected project repository

The owner supplied https://github.com/shn1ggy/localtone. Repository, homepage and issue metadata now point there. Version 0.109.0 was uploaded to `main` at commit `a8351514ed585bd5e5b814a1518d1a6064064816`; its complete Git tree hash matches the tested local source, including the binary icons and generated test fixtures. No user data was included. [Initial verification run](https://github.com/shn1ggy/localtone/actions/runs/38132531466).

The repository is currently private. Make the project/contact route public before distributing an app that relies on this URL for its MusicBrainz identification. Passing source CI does not replace native packaging, signing or real-device audio tests.

## In-app update checks and downloads (0.111)

About → Check for updates requests `https://api.github.com/repos/shn1ggy/localtone/releases/latest` without authentication. Only public stable releases with numeric tags (`v0.112.0` or `0.112.0`) are eligible. Drafts/pre-releases are not this channel. The currently private repository has no publicly accessible releases, so the UI reports an unavailable public feed instead of claiming to be up to date. Never bundle a maintainer token or ask listeners for one.

Attach each supported desktop archive named `Localtone-VERSION-mac-ARCH.zip`, `Localtone-VERSION-win-ARCH.zip` or `Localtone-VERSION-linux-ARCH.zip`, with `ARCH` equal to `arm64` or `x64`. Source archives, portable EXEs and AppImages are not selected by this first download workflow. Attach one `checksums.json` with schema 1 and artifacts containing exact `name`, byte `size` and lowercase `sha256`. When assembling artifacts from multiple OS builds, merge their artifact records into a single manifest; do not overwrite one OS's checksums with another's. Recompute/verify checksums after signing and all final artifact modifications.

The app bounds metadata/download sizes, restricts HTTPS redirect hosts, streams downloads to temporary files and validates SHA-256/byte count before exposing them. Cancellation, failure and normal shutdown remove temporary download files. Existing destination files are preserved. These checks establish integrity relative to the GitHub feed; they are not an independent developer signature or Apple notarization.

Installation is still explicit: download, reveal, extract, then Prepare update… and launch the new version. Preparation verifies the extracted release and copies persistent portable data, including the browsing session, while keeping the old app/data intact. System data mode remains system data. Extraction, replacement and Restart to update are not implemented. Test real old-version → new-version transfers before publishing.

Automatic native installation remains a later stage. Standard electron-updater supports Windows NSIS, signed macOS builds with update ZIP metadata, and supported Linux targets. Windows portable EXE/ZIP needs a separate replacement helper or an installer distribution. Native signing/notarization and real cross-platform tests remain release requirements; do not treat this manual download flow as a signed automatic updater.

References: https://docs.github.com/en/rest/releases/releases#get-the-latest-release and https://www.electron.build/v26/docs/features/auto-update/

## Private release candidates

Build unsigned test packages now runs when release-related files change on main, or manually. It builds Linux x64, Windows x64, macOS arm64 and macOS x64 on matching native runners. The final job verifies each platform manifest and assembles one `verified-release-candidate` artifact with combined checksums. Extract this workflow artifact to obtain the actual app downloads. Jobs have read-only repository permissions; they do not create or publish releases. Publish the verified inner ZIPs and combined checksums only after native testing and redistribution review. Repository visibility is a separate owner decision.

## 0.113 interaction candidate

This candidate fixes sidebar focus feedback, keeps confirmed searches in the current tab and preserves their static-playlist action across tabs. Album title clicks select the album's tracks; artwork clicks expand/collapse. General → Library adds opt-in continuous renumbering across discs. Source collections and playing tracks share a subtle playback marker. All existing appearance preferences are preserved.

Before publishing a release, confirm repository visibility with the owner, finish the FFmpeg corresponding-source/provenance review, and test downloaded native builds. Private Actions artifacts are temporary test downloads, not public Releases and not an update feed. The in-app updater reads public stable releases only; marking a release as prerelease intentionally keeps it out of that feed. Do not silently mark an untested alpha as stable to make updates work.

## Decoder source assets (0.114+)

Upload every `Localtone-VERSION-ffmpeg-source-PLATFORM-ARCH.tar.gz` alongside the matching application downloads and checksums. They contain the unmodified pinned source, license texts, build recipe, actual configuration and compiler/provenance record. Native packaging rejects nonfree, GPL-only and hash-mismatched decoders. Previous unsigned candidates with prebuilt decoders are not release assets.

## Verified early-access publication

`Publish verified release` is triggered by an explicit change to `build/release-plan.json`. The plan pins the app commit and its successful native build run. The publishing job downloads that run's combined candidate, creates the source ZIP from the pinned app commit, checks archive CRCs, internal update manifests, decoder/source hashes and dependency notices, then uploads all files to a draft. It verifies GitHub's uploaded asset hashes before publishing. Numeric 0.x versions are pre-releases; 1.x and later are stable and become the latest release. Existing conflicting assets and already-published releases are never overwritten.

Only the publishing job has `contents: write`; its GitHub token is ephemeral. Actions used by that job are pinned to reviewed official revisions. No personal token or signing secret is stored. For a later early-access release, complete its native build, update the plan with that version/commit/run and add matching release notes. Physical hardware and signing validation remain separate release gates. Stable in-app update checks intentionally ignore pre-releases.

## macOS bundle integrity (0.115)

Early-access Mac builds use explicit ad-hoc signing (`mac.identity: "-"`), hardened runtime, and only the JIT and library-validation entitlements needed by Electron. They are not Developer ID signed or notarized. The decoder is ad-hoc signed during finalization before provenance is hashed; `signIgnore` prevents packaging from changing those bytes. Changing this to Developer ID signing requires removing that exclusion and redesigning the manifest/provenance signing order.

The native CI job verifies signatures and release hashes from the extracted ZIP and executes the packaged Electron runtime and decoder. Failures block publication. Manual Gatekeeper, playback and device tests remain required. Version 0.114 skipped app signing and can produce a damaged-app warning; use 0.115 instead once published.

For automated publication of a commit older than main, retain a `release/<version>` branch pointing at that exact verified commit before creating its tag. GitHub restricts release creation for workflow-changing commits without an existing branch/tag reference. Use the minimal job token; do not introduce a personal access token merely to work around this. The source checkout, native workflow run, branch and release tag must identify the same commit.
