# Localtone 0.129.0 — unpublished test build

- Fix interrupted normal playback and seeking: each HTTP range response owns its descriptor, so cancelling an older seek cannot close later or simultaneous reads.
- Keep immediate MP3 ratings and immutable playback copies without changing gapless preferences.
- Show the cached library and saved appearance before startup directory reconciliation. Apply fresh metadata in place, keeping search, scroll, selection and playback; serialize edits until checking finishes.
- Align empty artist and track messages, headings and descriptions with their pane toolbar in every view.
- Add regression coverage for cancelled/concurrent audio reads, early cached UI, deferred file writes, and late refresh preserving browsing state.

No public release. Test at 100% app zoom and Windows display scaling of 100%, 125% and 130%.
