# Synthetic audio fixtures

`gapless-a.mp3` and `gapless-b.mp3` are generated test signals, not recordings.
Each contains 36,000 stereo frames at 48,000 Hz, encoded with FFmpeg's
`libmp3lame` encoder. Both channels use `0.2 * sin(frame * 0.037)`; the second
file starts at frame 36,000. The matching floating-point WAV generation is in
`build/check-playback.cjs`.

Keeping the encoded fixtures lets the tests run with the release decoder,
which intentionally excludes MP3 encoding. Tests compare decoded samples and
encoder padding without requiring an encoder in the app.
