# Localtone roadmap

[← Project home](../README.md)

Localtone focuses on local music collections, compact browsing and keyboard control. Version 1.0.0 was the first stable release; 1.1.0 adds tagging and library-management improvements. This is a direction, not a release schedule; feedback and reliability take priority over feature count.

## Now — confidence for more listeners

- Broaden real-world testing on Windows, both Mac processors and Linux: seeking, audio outputs/Bluetooth, long queues, large collections and session restoration.
- Test first run, portable updates and moving libraries with people who did not build the app.
- Keep the README, screenshots, user guide and release notes current.
- Collect reproducible reports for different grouping, sorting, multi-disc and compilation workflows.

Automated coverage already runs across all three operating systems, including Windows window checks at several display scales. That does not establish sound quality, universal hardware compatibility or screen-reader accessibility. See [release readiness](development/RELEASE-READINESS.md) for the technical record.

## Next — installation and usability

- Signed Windows builds and Apple signing/notarization, subject to maintainer setup and validation.
- A focused accessibility review: readable contrast, visible keyboard focus, accessible names, screen-reader testing and a conventional toolbar-focus route.
- Review first-run and library-maintenance language using independent tester feedback.
- Make the release pipeline faster while preserving archive verification and explicit publication approval.

## Candidates — discuss before implementing

- **M3U/M3U8 playlist import/export:** interoperability and understandable handling of relative paths or unavailable files.
- **ReplayGain:** read existing gain tags, clear playback controls and headroom/clipping behavior; verify on real audio outputs.
- Further large-library performance work guided by measurements and representative collections.

Streaming integrations and a plugin platform are not currently promised. They should not weaken the local-library experience.

## Suggest something

[Open a feature request](https://github.com/shn1ggy/localtone/issues/new/choose) with the task you are trying to complete, your current workaround and how keyboard navigation should behave. A small, clear workflow is more useful than a long feature list.
