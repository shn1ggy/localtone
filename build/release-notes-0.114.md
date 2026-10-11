First public early-access build of Localtone, a compact local music player for macOS, Windows and Linux.

### Downloads

Choose the ZIP for your OS and processor. Mac: `arm64` for Apple Silicon, `x64` for Intel. Windows: extract the complete ZIP and open Localtone.exe, or use the portable EXE. Linux: use the ZIP or executable AppImage. No Node.js is needed for these desktop downloads. Source archives are for developers.

### Verification and installation

All 321 automated tests pass on Windows, macOS and Linux. The four native packages pass decoder checks for MP3, FLAC, WAV, Ogg Vorbis, Opus, ALAC/M4A, AAC and AIFF, with waveform and gapless PCM output. Archive checksums and Localtone's internal update manifests are checked before publication.

These builds are unsigned and not notarized. macOS and Windows may display trust warnings or block launch according to system policy. Physical Mac and Windows hardware testing remains outstanding. Keep a settings backup and try a copy of your music before batch tag edits or renaming.

### Updates and portable data

Settings → About reports the running version and actual data folder. Extract future updates separately and use Prepare update… to verify them and transfer portable data. Online update checks currently follow stable GitHub releases; this early-access pre-release is downloaded here. The app does not overwrite itself or restart automatically.

### Decoder source and licenses

FFmpeg is built from the same pinned, unmodified 9.0.2 source on each platform, without nonfree or GPL-only components. Matching decoder source archives include the complete source, license texts, actual configuration, compiler identity and build instructions. The app includes production dependency notices, including licenses embedded in upstream READMEs. SHA256SUMS.txt and checksums.json verify download integrity; they are not publisher signatures.

Localtone is GPL-3.0-or-later. Report bugs with your OS, processor, Localtone version and reproduction steps in repository Issues.
