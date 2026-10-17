const root = require('node:path').resolve(__dirname, '..');
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs'),
  path = require('node:path');
fs.mkdirSync(path.join(root, 'docs', 'images'), { recursive: true });
const base = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'localtone-presentation-')),
  data = path.join(base, 'data'),
  music = path.join(base, 'Music');
fs.mkdirSync(data, { recursive: true });
fs.mkdirSync(path.join(data, 'covers'), { recursive: true });
app.disableHardwareAcceleration();
app.on('quit', () => {
  try {
    fs.rmSync(base, { recursive: true, force: true });
  } catch {}
});
app.setPath('userData', data);
app.requestSingleInstanceLock = () => true;
require(root + '/portable.cjs').configurePortable = () => {};
// Synthetic sound and original geometric artwork; no user music or credentials.
require('node:child_process').execFileSync(require('ffmpeg-static'), [
  '-v',
  'error',
  '-f',
  'lavfi',
  '-i',
  'aevalsrc=0.12*sin(2*PI*220*t)*(0.5+0.3*sin(t*0.7)+0.15*sin(t*2)):s=22050:d=185',
  '-b:a',
  '32k',
  path.join(base, 'demo.mp3'),
  '-y',
]);
const albums = JSON.parse(fs.readFileSync(path.join(__dirname, 'demo-art', 'albums.json'))),
  tracks = [];
const names = [
  'First Light',
  'Between the Lines',
  'Long Way Home',
  'Small Hours',
  'Everything in Motion',
  'The Other Side',
];
const id3 = require(root + '/node_modules/node-id3');
for (let a = 0; a < albums.length; a++) {
  const [artist, album, year, genre] = albums[a];
  const dir = path.join(music, artist, `${year} ${album.replace('/', '-')}`);
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 6; i++) {
    const id = `demo-${a}-${i}`,
      file = path.join(dir, `${String(i + 1).padStart(2, '0')} ${names[i]}.mp3`);
    fs.copyFileSync(path.join(base, 'demo.mp3'), file);
    id3.write(
      {
        title: names[i],
        artist,
        performerInfo: artist,
        album,
        year: String(year),
        genre,
        trackNumber: `0${i + 1}/06`,
      },
      file,
    );
    const stat = fs.statSync(file);
    fs.copyFileSync(path.join(__dirname, 'demo-art', `${a}.jpg`), path.join(data, 'covers', id));
    tracks.push({
      id,
      path: file,
      libraryId: 'demo',
      title: names[i],
      artist,
      albumArtist: artist,
      album,
      year,
      genre,
      trackRaw: `0${i + 1}/06`,
      track: i + 1,
      disc: 1,
      discRaw: '',
      duration: 185,
      codec: 'MP3',
      addedAt: Date.now(),
      modifiedAt: stat.mtimeMs,
      missingTags: [],
      mtime: stat.mtimeMs,
      size: stat.size,
      cover: true,
      tagRating: i % 3 === 0 ? 5 : i % 3 === 1 ? 4 : null,
    });
  }
}
fs.writeFileSync(
  path.join(data, 'collection.json'),
  JSON.stringify({
    libraries: [{ id: 'demo', name: 'Music', root: music }],
    tracks,
    playlists: [
      { id: 'evening', name: 'Evening rotation', trackIds: tracks.slice(0, 18).map((t) => t.id) },
      {
        id: 'favorites',
        name: 'Four stars & up',
        trackIds: [],
        dynamic: {
          enabled: true,
          libraryId: '',
          mode: 'rules',
          match: 'all',
          rules: [{ field: 'rating', op: 'gte', value: 4 }],
        },
      },
      { id: 'later', name: 'Listen later', trackIds: tracks.slice(30).map((t) => t.id) },
    ],
    settings: {
      lastView: 'covers',
      libraryOpening: 'none',
      sidebarWidth: 242,
      artistWidth: 240,
      defaultSort: 'year',
      queuePresentation: 'overlay',
    },
  }),
);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
app.on('browser-window-created', (_, win) =>
  win.webContents.once('did-finish-load', async () => {
    try {
      win.setContentSize(1440, 900);
      win.webContents.setZoomFactor(1);
      const js = (c) => win.webContents.executeJavaScript(c);
      await delay(1600);
      console.log(
        await js(
          "JSON.stringify({tracks:document.querySelectorAll('[data-track]').length,artists:document.getElementById('artist-list').textContent,playlists:document.getElementById('playlists').textContent})",
        ),
      );
      const snap = async (name) => {
        await delay(500);
        fs.writeFileSync(
          path.join(root, 'docs', 'images', name + '.png'),
          (await win.webContents.capturePage()).toPNG(),
        );
      };
      await js("document.getElementById('view-tracks').click()");
      await delay(400);
      console.log(
        await js(
          "[...document.querySelectorAll('[data-track-id], [data-id]')].slice(0,5).map(x=>x.outerHTML.slice(0,300))",
        ),
      );
      await js(
        "document.querySelector('#libraries [data-source-kind]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));void 0",
      );
      await delay(800);
      await js(
        "document.getElementById('audio').currentTime=43;document.getElementById('view-covers').click();document.activeElement.blur();void 0",
      );
      await snap('localtone-covers');
      await js("document.getElementById('view-albums').click()");
      await snap('localtone-albums');
      await js(
        "document.getElementById('open-settings').click();document.getElementById('settings-tab-appearance').click()",
      );
      await snap('localtone-appearance');
      await js(
        "document.getElementById('close-settings').click();document.getElementById('view-covers').click()",
      );
      for (let i = 0; i < 6; i++) {
        const keys = ['Tab', 'ArrowDown', 'Enter', 'x', 'x', 'p'];
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode: keys[i] });
        win.webContents.sendInputEvent({ type: 'keyUp', keyCode: keys[i] });
        await snap('demo-frame-' + i);
      }
      console.log('CAPTURE_COMPLETE');
      app.exit(0);
    } catch (e) {
      console.error(e);
      app.exit(1);
    }
  }),
);
setTimeout(() => app.exit(2), 90000).unref();
require(root + '/main.cjs');
