# Security and supported builds

Localtone is currently a pre-release project. Only the latest development release receives fixes; there is no long-term-support promise.

Before public launch, maintainers must enable GitHub private vulnerability reporting (Security → Advisories → Report a vulnerability) and verify a working confidential contact route. That route is not yet configured. Do not post credentials, private files, exploit details or unredacted app data in public issues. This document does not claim a functioning private reporting channel before setup.

The renderer uses sandboxing, context isolation, disabled Node integration, a restrictive CSP, a local protocol allowlist, denied child windows/navigation and validated IPC senders. Filesystem changes require current file identity checks; arbitrary remote code is not loaded. Last.fm credentials use the OS credential store and reject the insecure basic_text fallback. These are safeguards, not a guarantee against all vulnerabilities.

When investigating, check both JavaScript packages and bundled binaries. `npm audit` does not establish the safety of Electron's Chromium/Node runtime or the downloaded FFmpeg build. Review Electron's security checklist and supported versions before each public release.
