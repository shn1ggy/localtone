# Localtone decoder source build

Release decoders use the unmodified FFmpeg commit in `source.json` (signed upstream tag n9.0.2). No GPL-only, nonfree or autodetected external libraries are enabled. Internal decoders remain available for all supported local audio formats. FFmpeg's complete license texts are included in the source archive; this configuration uses LGPL-2.1-or-later.

On Linux install GCC, make and NASM. On macOS install Xcode command line tools, make and NASM. On Windows use MSYS2 MINGW64 with `mingw-w64-x86_64-gcc`, `make`, `nasm`, and `diffutils`. Run from a Localtone checkout:

```sh
git clone https://github.com/FFmpeg/FFmpeg.git ffmpeg-source
git -C ffmpeg-source checkout 946fcce07b6dcd0331c8cc609192aeff5e1924f8
bash build/ffmpeg/build.sh
node build/ffmpeg/finalize.mjs
```

Run `npm ci` before finalizing. Finalize verifies the source revision and executable, replaces the development decoder, and creates the corresponding source archive in `dist`. Native packaging refuses an unverified decoder. Each source archive contains the pristine source, build recipe, actual configuration and per-platform provenance. The archive filename is recorded in the application's `localtone-build-audit.json`. The build can be reproduced; byte-for-byte binary reproducibility is not promised across toolchain versions.
