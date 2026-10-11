import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { verifyDecoder } = require('../build/ffmpeg/policy.cjs');
const source = require('../build/ffmpeg/source.json');
test('release decoder rejects nonfree, downloaded, stale and hash-mismatched binaries', () => {
 const report = { commit: source.commit, sha256: 'verified', sourceArchive: 'matching-source.tar.gz' };
 const output = 'ffmpeg version 9.0.2\nconfiguration: --disable-autodetect';
 assert.equal(verifyDecoder(output, report, 'verified'), report);
 for (const flag of ['nonfree', 'gpl', 'version3']) assert.throws(() => verifyDecoder(output + ' --enable-' + flag, report, 'verified'), /prohibited/);
 assert.throws(() => verifyDecoder(output, null, 'verified'), /provenance/);
 assert.throws(() => verifyDecoder(output, { ...report, commit: 'other' }, 'verified'), /provenance/);
 assert.throws(() => verifyDecoder(output, report, 'other'), /provenance/);
 assert.throws(() => verifyDecoder('configuration: autodetected', report, 'verified'), /configuration/);
 assert.throws(() => verifyDecoder(output, { ...report, sourceArchive: '' }, 'verified'), /source archive/);
});
