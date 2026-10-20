import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
test('file replacement retries briefly while another program holds the target, then reports persistent errors', async () => {
 const fs = require('node:fs/promises'), { replaceFile, replaceFileSync } = require('../src/replace-file.cjs');
 const dir = await mkdtemp(path.join(tmpdir(), 'localtone-replace-'));
 const original = fs.rename;
 try {
  const target = path.join(dir, 'state.json');
  await writeFile(target, 'old'); await writeFile(target + '.tmp', 'new');
  let calls = 0; const waits = [];
  fs.rename = async (...args) => { if (++calls < 3) throw Object.assign(Error('locked'), { code: 'EPERM' }); return original(...args); };
  await replaceFile(target + '.tmp', target, { wait: async (ms) => waits.push(ms) });
  assert.equal(await readFile(target, 'utf8'), 'new'); assert.equal(calls, 3); assert.deepEqual(waits, [20, 40]);
  calls = 0; fs.rename = async () => { calls++; throw Object.assign(Error('locked'), { code: 'EBUSY' }); };
  await assert.rejects(replaceFile('a', 'b', { attempts: 4, wait: async () => {} }), /locked/); assert.equal(calls, 4);
  calls = 0; fs.rename = async () => { calls++; throw Object.assign(Error('gone'), { code: 'ENOENT' }); };
  await assert.rejects(replaceFile('a', 'b', { wait: async () => {} }), /gone/); assert.equal(calls, 1, 'other errors are not retried');
  fs.rename = original;
  await writeFile(target + '.tmp', 'sync'); replaceFileSync(target + '.tmp', target); assert.equal(await readFile(target, 'utf8'), 'sync');
 } finally { fs.rename = original; await rm(dir, { recursive: true, force: true }); }
});
