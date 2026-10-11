import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { inspectRelease } = require('../release.cjs');
if (process.platform !== 'darwin') throw Error('Mac package verification requires macOS.');
const version = require('../package.json').version;
const archive = path.resolve(`dist/Localtone-${version}-mac-${process.arch}.zip`);
const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'localtone-mac-verification-'));
const run = (cmd, args, options = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', timeout: 30000, ...options });
try {
  run('/usr/bin/ditto', ['-x', '-k', archive, folder]);
  const app = path.join(folder, 'Localtone.app');
  // Test the downloadable archive, not just the pre-archive build directory.
  run('/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', app]);
  const decoder = path.join(
    app,
    'Contents/Resources/app.asar.unpacked/node_modules/ffmpeg-static/ffmpeg',
  );
  run('/usr/bin/codesign', ['--verify', '--strict', '--verbose=2', decoder]);
  await inspectRelease(app, '0.0.0');
  const runtime = run(
    path.join(app, 'Contents/MacOS/Localtone'),
    [
      '-e',
      'console.log(JSON.stringify({arch:process.arch,electron:process.versions.electron,jit:new Function("return 42")()}))',
    ],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } },
  );
  const result = JSON.parse(runtime.trim());
  if (result.arch !== process.arch || !result.electron || result.jit !== 42)
    throw Error('Packaged Electron runtime did not start correctly.');
  run(decoder, ['-version']);
  console.log('Extracted Mac package: signatures, release hashes, Electron and decoder verified.');
} finally {
  await fs.rm(folder, { recursive: true, force: true });
}
