import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { createNameDialog } from '../app/name-dialog.js';
const html = await readFile(new URL('../app/index.html', import.meta.url), 'utf8');
function setup() {
 const dom = new JSDOM(html), { document } = dom.window;
 const dialog = document.getElementById('name-dialog');
 // DOM tests emulate dialog visibility; no native desktop window is involved.
 dialog.showModal = () => dialog.setAttribute('open', '');
 dialog.close = () => { dialog.removeAttribute('open'); dialog.dispatchEvent(new dom.window.Event('close')); };
 return { dom, document, dialog, open: createNameDialog(document), input: document.getElementById('name-input') };
}
test('Return submits a new playlist name, never Cancel', async () => {
 const { dom, open, input } = setup(); const result = open('New playlist');
 input.value = ' Evening '; input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
 assert.equal(await result, 'Evening'); dom.window.close();
});
test('Add button submits library name', async () => {
 const { dom, document, open, input } = setup(); const result = open('Add library', 'My music');
 input.value = 'FLAC'; document.getElementById('name-save').click(); assert.equal(await result, 'FLAC'); dom.window.close();
});
test('Cancel and Escape return no name; reopening does not keep stale listeners', async () => {
 const { dom, document, dialog, open, input } = setup();
 let result = open('New playlist'); document.getElementById('name-cancel').click(); assert.equal(await result, null);
 result = open('New playlist'); dialog.dispatchEvent(new dom.window.Event('cancel', { cancelable:true })); assert.equal(await result, null);
 result = open('New playlist'); input.value = 'Third'; document.getElementById('name-save').click(); assert.equal(await result, 'Third'); dom.window.close();
});
test('whitespace is rejected and corrected text can submit', async () => {
 const { dom, document, dialog, open, input } = setup(); const result = open('New playlist');
 input.value = '   '; document.getElementById('name-save').click(); assert.equal(dialog.hasAttribute('open'),true); assert.equal(input.validity.valid,false);
 input.value = 'Valid'; input.dispatchEvent(new dom.window.Event('input')); document.getElementById('name-save').click(); assert.equal(await result,'Valid'); dom.window.close();
});
