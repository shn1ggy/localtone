#!/usr/bin/env bash
# Run from the Localtone checkout, with the pinned FFmpeg checkout in ffmpeg-source.
set -euo pipefail
project_root="$PWD"
source_root="${1:-$project_root/ffmpeg-source}"
mkdir -p "$project_root/ffmpeg-build"
cd "$project_root/ffmpeg-build"
args=(--disable-autodetect --disable-debug --disable-doc --disable-network
  --disable-devices --disable-avdevice --disable-swscale
  --disable-programs --enable-ffmpeg --disable-encoders
  --enable-encoder=pcm_f32le,pcm_s16le --disable-muxers
  --enable-muxer=f32le,s16le,null --disable-filters
  --enable-filter=aresample,aformat,anull,atrim,asetpts)
case "$(uname -s)" in
  MINGW*|MSYS*) args+=(--target-os=mingw32 --extra-ldflags=-static) ;;
  Linux*) args+=(--extra-ldflags=-static) ;;
esac
# CI installs NASM for x86. This fallback allows a documented developer build.
if ! command -v nasm >/dev/null 2>&1; then args+=(--disable-x86asm); fi
"$source_root/configure" "${args[@]}"
make -j "${FFMPEG_BUILD_JOBS:-4}"
