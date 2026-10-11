# Localtone licensing

Localtone-owned source code and original project assets are licensed under the GNU General Public License, version 3 or (at your option) any later version (`GPL-3.0-or-later`). This choice was approved by the project owner on 11 October 2026. The complete, unchanged GPL version 3 text is in [LICENSE](LICENSE).

Copyright (C) 2026 Nico Sanft and Localtone contributors.

Localtone is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

Localtone is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with Localtone. If not, see https://www.gnu.org/licenses/.

Third-party software, notices and separately attributed assets retain their own applicable licenses and copyright notices. The Localtone license does not replace those terms or certify that all native redistribution obligations have been completed.

Important bundled component: the installed ffmpeg-static 5.3.0 package declares GPL-3.0-or-later. The inspected Linux executable reports FFmpeg 7.0.2 with --enable-gpl and --enable-version3, and its accompanying notice identifies GPLv3. The package's configured download tag says b6.1.1, so package version/tag alone is not adequate evidence of the binary actually shipped. Record actual binary version/configuration, architecture, hash, upstream source/build provenance and notices on each target OS. Different targets may use different upstream builds.

Before native public distribution:

1. Retain LICENSE, this licensing notice and the GPL-3.0-or-later package metadata in source and desktop distributions.
2. Generate a complete inventory of packaged production dependencies (including transitive packages), retain required copyright/license notices, and verify icons/test-fixture provenance.
3. Establish a compliant corresponding-source distribution for the exact FFmpeg builds shipped, including relevant build configuration/dependencies; do not treat a generic upstream homepage as sufficient evidence.
4. Include Electron/Chromium notices and third-party notices in the built app and make them reachable from About or bundled documentation.
5. Recheck dependency licensing when switching binaries or changing the application's license. Obtain qualified review if the compatibility or redistribution obligations remain uncertain.

References checked 11 October 2026:
- https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository
- https://choosealicense.com/
- https://github.com/eugeneware/ffmpeg-static
- https://ffmpeg.org/legal.html

The MusicBrainz User-Agent now identifies the running Localtone version and https://github.com/shn1ggy/localtone. Before a public app release, ensure that this repository and a maintained contact route are publicly accessible; a private repository URL alone is not a publicly contactable route. Review Last.fm API distribution/credential setup before promising one-click login to the public.

As of 0.106, native packaging generates `localtone-build-audit.json` and `THIRD-PARTY-NOTICES.txt` from the shipped app archive and decoder. Use these as review evidence rather than relying only on package-lock.json. Packages without included notice files or with unspecified license metadata need manual review. The automatically collected text is not a claim that all redistribution requirements are satisfied, and it does not supply FFmpeg corresponding source.
