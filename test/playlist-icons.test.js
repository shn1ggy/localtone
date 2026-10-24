import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createPlaylistEditor } from '../app/playlist-editor.js';
import { createIcons } from '../app/icons.js';
import '../app/rules/playlist-icons.js';
import transfer from '../src/settings-transfer.cjs';
const catalog = globalThis.LocaltonePlaylistIcons;
const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');

test('playlist icons validate stable IDs, fall back for older playlists, and survive collection transfer', () => {
  assert.equal(catalog.entries.length, 32);
  assert.equal(catalog.playlistIcon({ dynamic: { enabled: true } }), 'dynamic');
  assert.equal(catalog.playlistIcon({ icon: 'unknown' }), 'playlist');
  for (const invalid of ['unknown', '<svg/>', '__proto__', null, 42, {}])
    assert.throws(() => catalog.validateIcon(invalid));
  const collections = { libraries: [], tracks: [], playlists: [{ id: 'p', name: 'Night', icon: 'moon', trackIds: [] }] };
  const clean = transfer.validateCollections(JSON.parse(JSON.stringify(collections)));
  const merged = transfer.mergeCollections({ ...collections, playlists: [], ratings: {} }, clean, () => 'new');
  assert.equal(merged.playlists[0].icon, 'moon');
  collections.playlists[0].icon = '<svg/>';
  assert.throws(() => transfer.validateCollections(collections));
});

test('playlist editor saves chosen icons, cancels drafts, resets defaults, and gives Escape priority', async () => {
  const dom = new JSDOM(html), document = dom.window.document;
  const $ = (id) => document.getElementById(id);
  const dialog = $('playlist-settings-dialog');
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.dispatchEvent(new dom.window.Event('close')); };
  const el = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  let actions = [];
  const state = { libraries: [], tracks: [], playlists: [] };
  const editor = createPlaylistEditor({ document, el, icon: createIcons(document).icon,
    api: { playlist: async (action) => { actions.push(action); return true; } },
    dialogs: { open: (node) => node.showModal() }, getState: () => state,
    isBusy: () => false, operation: (work) => work(), setScope() {}, onConfigured() {} });
  const key = (value) => document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  try {
    editor.open(null);
    $('playlist-name').value = 'Night';
    $('playlist-icon-trigger').click();
    assert.equal($('playlist-icon-picker').hidden, false);
    assert.equal(document.activeElement.dataset.playlistIcon, 'playlist');
    key('ArrowRight');
    assert.equal(document.activeElement.dataset.playlistIcon, 'star');
    key('Escape');
    assert.equal(dialog.open, true);
    assert.equal($('playlist-icon-picker').hidden, true);
    assert.equal(document.activeElement, $('playlist-icon-trigger'));
    $('playlist-icon-trigger').click();
    document.querySelector('[data-playlist-icon="moon"]').click();
    $('playlist-settings-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(actions[0].icon, 'moon');
    assert.equal(actions[0].type, 'create');
    const existing = { id: 'p', name: 'Saved', icon: 'heart', trackIds: [] };
    state.playlists.push(existing);
    editor.open(existing);
    $('playlist-icon-trigger').click();
    document.querySelector('[data-playlist-icon="star"]').click();
    $('playlist-settings-cancel').click();
    editor.open(existing);
    assert.equal($('playlist-icon-trigger').firstChild.dataset.icon, 'heart');
    $('playlist-icon-trigger').click();
    document.querySelector('.playlist-icon-reset').click();
    $('playlist-dynamic').checked = true;
    $('playlist-dynamic').dispatchEvent(new dom.window.Event('change'));
    assert.equal($('playlist-icon-trigger').firstChild.dataset.icon, 'dynamic');
    $('playlist-settings-form').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(actions.at(-1).icon, '');
    assert.equal(actions.at(-1).type, 'configure');
    $('playlist-icon-trigger').click();
    $('playlist-name').dispatchEvent(new dom.window.Event('pointerdown', { bubbles: true }));
    assert.equal($('playlist-icon-picker').hidden, true);
    editor.dispose();
    assert.equal($('playlist-icon-picker'), null);
  } finally { dom.window.close(); }
});
