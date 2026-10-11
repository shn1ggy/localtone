> Historical assessment before the optional buffered playback path was implemented. See README.md and VALIDATION.md for current behavior and limits.

# Gapless playback — version 0.61

The v0.59 assessment found an ended-event transition in the original HTML audio path. Version 0.61 adds an optional Audio → Gapless playback setting and a separate buffered path. Normal playback remains the default.

FFmpeg decodes current/next tracks to stereo float PCM at the output context sample rate. AudioBufferSourceNodes schedule the next buffer at the current buffer's computed end on the same audio clock. UI events update queue and metadata after that boundary; they do not trigger the audio transition. No crossfade or silence removal is applied. Embedded silence remains part of the source. FFmpeg handles the source format's encoder delay/padding where supported.

Only two decoded buffers are cached. A 256 MiB per-track decode limit and 90-second decode timeout trigger native playback fallback. At 48 kHz this limit is approximately 11.6 minutes of stereo audio. Decoding complete songs increases memory and can delay initial playback. Output changes route the AudioContext and native element together. Seeking, queue changes, pause/resume and repeat are covered by automated scheduler tests.

Verification: real FFmpeg decoding of two adjoining stereo float WAV fixtures; the decoded samples match their continuous reference. A simulated audio-clock scheduler verifies exactly one scheduled sample at each frame in the joined interval, with neither insertion nor overlap. Separate renderer integration confirms that queue/current-song metadata advance without restarting the scheduled next source. Tests cover seeking, pausing, queue changes, repeat-one reuse, output/gain propagation, simultaneous play requests, fallback, and disabling without losing position. These are not native audio-device loopback measurements.

Before claiming device-level sample accuracy across operating systems, record loopback output of adjoining reference tracks and inspect the transition for inserted/dropped samples. Repeat with supported compressed formats, live albums, device changes and background playback. Actual output testing remains outstanding.

Scheduling API reference: https://www.w3.org/TR/webaudio-1.0/#AudioBufferSourceNode
