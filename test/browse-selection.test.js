import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowseSelection, createSelectionGroup} from '../app/browse-selection.js';

test('shift ranges grow and shrink from a stable anchor, with additive selection', () => {
  const group = createSelectionGroup(), order = ['a', 'b', 'c', 'd', 'e'];
  group.select('b');
  group.range(order, 'e');
  group.current = 'e';
  assert.deepEqual([...group], ['b', 'c', 'd', 'e']);
  group.range(order, 'c');
  assert.deepEqual([...group], ['b', 'c']);
  assert.equal(group.anchor, 'b');
  group.add('e');
  group.range(order, 'a', {additive: true});
  assert.deepEqual([...group], ['b', 'c', 'e', 'a']);
  group.clear();
  assert.equal(group.anchor, 'b');
  group.range(order, 'a');
  assert.deepEqual([...group], ['a', 'b']);
});

test('filtered-out range anchors fall back to target and snapshots cannot mutate selection', () => {
  const group = createSelectionGroup();
  group.select('gone');
  group.range(['a', 'b'], 'b');
  assert.deepEqual([...group], ['b']);
  group.snapshot().keys.push('a');
  group.range(['a', 'b'], 'missing');
  assert.deepEqual([...group], ['b']);
});

test('collection changes clear independent selections and detail focus while retaining active pane', () => {
  const selection = createBrowseSelection();
  selection.pane = 'artists';
  for (const group of [selection.tracks, selection.artists, selection.albums, selection.openedAlbums]) group.select('a');
  selection.tracks.toggle('a');
  assert.equal(selection.artists.has('a'), true);
  selection.coverFocus = selection.albumFocus = selection.albumDetail = 'a';
  selection.resetCollection();
  for (const group of [selection.tracks, selection.artists, selection.albums, selection.openedAlbums]) {
    assert.deepEqual(group.snapshot(), {keys: [], current: null, anchor: null});
  }
  assert.equal(selection.coverFocus, null);
  assert.equal(selection.albumFocus, null);
  assert.equal(selection.albumDetail, null);
  assert.equal(selection.pane, 'artists');
  selection.cyclePane(1);
  assert.equal(selection.pane, 'tracks');
  selection.cyclePane(1);
  assert.equal(selection.pane, 'sidebar');
  selection.cyclePane(-1);
  assert.equal(selection.pane, 'tracks');
});
