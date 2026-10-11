import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const source = require('./source.json');
const { digest } = require('../../release.cjs');
const root = process.cwd();
const sourceRoot = path.join(root, 'ffmpeg-source');
const buildRoot = path.join(root, 'ffmpeg-build');
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { encoding: 'utf8', ...options });
if (run('git', ['-C', sourceRoot, 'rev-parse', 'HEAD']).trim() !== source.commit)
  throw Error('FFmpeg source revision mismatch.');
if (run('git', ['-C', sourceRoot, 'status', '--porcelain', '--untracked-files=no']).trim())
  throw Error('FFmpeg source has modifications.');
const binary = path.join(buildRoot, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
const versionOutput = run(binary, ['-version']);
const config = await fs.readFile(path.join(buildRoot, 'ffbuild/config.mak'), 'utf8');
const compiler = /^CC_IDENT=(.+)$/m.exec(config)?.[1];
if (!compiler) throw Error('Missing compiler identity in FFmpeg build configuration.');
const pkg = require('../../package.json');
const sourceArchive = `Localtone-${pkg.version}-ffmpeg-source-${process.platform}-${process.arch}.tar.gz`;
const provenance = {
  schema: 1,
  ...source,
  platform: process.platform,
  arch: process.arch,
  sha256: await digest(binary),
  sourceArchive,
  versionOutput,
  compiler,
};
require('./policy.cjs').verifyDecoder(versionOutput, provenance, provenance.sha256);
const folder = path.join(root, 'node_modules', 'ffmpeg-static');
await fs.copyFile(binary, path.join(folder, path.basename(binary)));
await fs.chmod(path.join(folder, path.basename(binary)), 0o755);
await fs.copyFile(path.join(sourceRoot, 'COPYING.LGPLv2.1'), path.join(folder, 'ffmpeg.LICENSE'));
await fs.copyFile(path.join(root, 'build/ffmpeg/README.md'), path.join(folder, 'ffmpeg.README'));
await fs.writeFile(
  path.join(folder, 'ffmpeg.provenance.json'),
  JSON.stringify(provenance, null, 2) + '\n',
);
const extras = path.join(buildRoot, 'Localtone-build');
await fs.mkdir(extras, { recursive: true });
for (const name of ['build.sh', 'source.json', 'README.md', 'finalize.mjs', 'policy.cjs'])
  await fs.copyFile(path.join(root, 'build/ffmpeg', name), path.join(extras, name));
await fs.copyFile(path.join(buildRoot, 'ffbuild/config.mak'), path.join(extras, 'config.mak'));
await fs.writeFile(
  path.join(extras, 'provenance.json'),
  JSON.stringify(provenance, null, 2) + '\n',
);
await fs.mkdir(path.join(root, 'dist'), { recursive: true });
const tar = path.join(root, 'dist', sourceArchive.slice(0, -3));
run('git', ['-C', sourceRoot, 'archive', '--format=tar', '--output=' + tar, source.commit]);
// GNU tar treats drive-letter paths as remote hosts. Relative POSIX paths
// work in MSYS2, BSD tar and GNU tar without platform-specific flags.
const portableTar = path.relative(root, tar).replaceAll('\\', '/');
run('tar', ['-rf', portableTar, '-C', 'ffmpeg-build', 'Localtone-build'], { cwd: root });
run('gzip', ['-f', portableTar], { cwd: root });
run('gzip', ['-t', portableTar + '.gz'], { cwd: root });
console.log('Verified source-built FFmpeg:', provenance.sha256, sourceArchive);
