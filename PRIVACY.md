# Localtone data and network behavior

Local playback, indexing, searching, dynamic playlists and waveform generation work with files on your computer. Localtone's application code does not include analytics or upload the music collection. This is a source review statement, not a network packet audit of every platform runtime.

Optional network actions:

- MusicBrainz comparison sends the album/artist search text and selected release identifier to musicbrainz.org. It does not upload audio. The service receives ordinary connection information such as your IP address.
- Last.fm sends listening metadata when connected and enabled, and stores pending scrobbles locally. Disconnecting clears the session and unsent scrobbles. Credentials are encrypted using the current OS account's keychain/keyring; portable mode does not make them transferable to another account.
- Search on web opens your browser with a DuckDuckGo `!g` query containing the selected artist/album/track terms; DuckDuckGo then routes the search to Google. Their browser/network policies apply.
- API credential help opens Last.fm in the system browser. Downloading development dependencies contacts their package and binary hosts.

Settings, library paths, indexed metadata, playlists, browsing/playback sessions, covers and waveforms are stored in the active data folder shown in Settings → About. Portable mode places Localtone-data beside the source folder/app bundle/executable. Settings exports may contain library paths and track metadata when collection export is enabled. They exclude music, caches and Last.fm credentials.

Tag/rating and rename undo lasts only for the current session. Metadata recovery snapshots are deleted on normal exit; settings/collection backups are separate. Clean unused cache deletes obsolete generated covers/waveforms only. Old app data cleanup retains a verified backup in the current portable folder. Unavailable-file records can preserve old paths and playlist references; Forget entry removes those references without deleting audio.

A public privacy statement should be reviewed whenever a network service, diagnostics upload or update feed is added. Do not claim “no internet ever” while optional services are enabled.
