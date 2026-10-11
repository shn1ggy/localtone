import { createSettingsHelp } from './app/settings-help.js';
import { createDuplicatesDialog } from './app/duplicates-dialog.js';
import { createFileNamingDialog } from './app/file-naming-dialog.js';
import { designDefaults, appearanceDefaults } from './app/design-defaults.js';
import { createSettingsWrites } from './app/settings-writes.js';
import { createTagEditor } from './app/tag-editor.js';
import { createPlaylistEditor } from './app/playlist-editor.js';
import { createLastfmSettings } from './app/lastfm-settings.js';
import { createDialogCoordinator } from './app/dialog-coordinator.js';
import { createSettingsTabs } from './app/settings-tabs.js';
import { createBrowseSelection } from './app/browse-selection.js';
import { createPlaybackQueue } from './app/playback-queue.js';
import { createWindowPresentation } from './app/window-presentation.js';
import { createAudioOutputSettings } from './app/audio-output-settings.js';
import { mountVirtualTracks } from './app/virtual-tracks.js';
import { createIcons } from './app/icons.js';
import { normalizeMenu } from './app/context-menu.js';
import { shortcutDefaults } from './app/shortcuts.js';
import { createQueueViewCache, queuePage } from './app/queue-view.js';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { JSDOM } from 'jsdom';
import * as core from './app/core.js';
import * as browse from './app/browse.js';
import * as interactions from './app/interactions.js';
import { createNameDialog } from './app/name-dialog.js';
import { ListenTracker } from './app/listen.js';
import { waveformPath } from './app/waveform-view.js';
const html = await readFile('./app/index.html', 'utf8'),
  source = (await readFile(process.argv[2] || './app/renderer.js', 'utf8')).replace(
    /^import[\s\S]*?;\n/gm,
    '',
  );
const dom = new JSDOM(html, { runScripts: 'outside-only' }),
  w = dom.window;
Object.assign(
  w,
  { createSettingsHelp },
  { createDuplicatesDialog, createFileNamingDialog },
  core,
  browse,
  interactions,
  { structuredClone },
  { designDefaults, appearanceDefaults },
  { createSettingsWrites },
  { createTagEditor, createPlaylistEditor, createLastfmSettings },
  { createDialogCoordinator, createSettingsTabs },
  { createBrowseSelection },
  { createPlaybackQueue },
  { createWindowPresentation, createAudioOutputSettings, mountVirtualTracks },
  { createIcons, normalizeMenu, shortcutDefaults, createQueueViewCache, queuePage },
  { createNameDialog, ListenTracker, waveformPath },
);
const albumMode = process.env.BENCH_ALBUMS === '1';
if (albumMode)
  w.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
const tracks = Array.from({ length: 5000 }, (_, i) => ({
  id: String(i),
  title: 'Track ' + i,
  artist: 'Artist ' + (albumMode ? Math.floor(i / 100) : i % 100),
  folderArtist: 'Artist ' + (albumMode ? Math.floor(i / 100) : i % 100),
  folderKey: String(albumMode ? Math.floor(i / 100) : i % 100),
  album: albumMode ? 'Album ' + Math.floor(i / 10) : 'Album',
  duration: 180,
  codec: 'MP3',
  libraryId: 'l',
  track: i,
}));
w.localtone = {
  load: async () => ({
    tracks,
    libraries: [{ id: 'l', name: 'Music' }],
    playlists: [],
    settings: {
      lastView: albumMode ? 'albums' : 'tracks',
      albumExpansion: 'expanded',
      libraryOpening: 'none',
    },
  }),
  onProgress() {},
};
const queueProbe =
  process.env.BENCH_QUEUE === '1'
    ? `playback.seed(state.tracks.map(t=>t.id),{kind:'all'});renderQueue();const original=$('queue-list').firstChild;const began=performance.now();for(let i=0;i<25;i++)renderQueue();window.queueBenchmark={iterations:25,ms:Math.round(performance.now()-began),preservedRow:original===$('queue-list').firstChild};`
    : '';
const start = performance.now();
await w.eval(`(async()=>{${source}\n${queueProbe}\n})()`);
console.log(
  JSON.stringify({
    ms: Math.round(performance.now() - start),
    rows: w.document.querySelectorAll('[data-track-id]').length,
    nodes: w.document.querySelectorAll('*').length,
    queue: w.queueBenchmark,
  }),
);
w.close();
