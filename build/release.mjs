import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { deflateRawSync } from 'node:zlib';
const require = createRequire(import.meta.url);
const { createManifest, digest } = require('../src/release.cjs');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const excluded = new Set([
  'node_modules',
  'Localtone-data',
  'local-data',
  'dist',
  '.git',
  '__pycache__',
]);
const projectDotfiles = new Set([
  '.github',
  '.gitignore',
  '.gitattributes',
  '.editorconfig',
  '.nvmrc',
]);
const projectFolders = new Set(['app', 'src', 'scripts', 'build', 'test', 'docs', '.github']);
export async function sourceFiles(dir = root, prefix = '') {
  const result = [];
  for (const entry of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (
      excluded.has(entry.name) ||
      /^(?:Localtone-data|local-data)(?:\.|$)/i.test(entry.name) ||
      (entry.name.startsWith('.') && !(prefix === '' && projectDotfiles.has(entry.name))) ||
      /\.(?:pem|p12|pfx|key)$/i.test(entry.name) ||
      (prefix === '' && entry.isDirectory() && !projectFolders.has(entry.name)) ||
      (prefix === '' &&
        entry.isFile() &&
        !projectDotfiles.has(entry.name) &&
        !/\.(?:md|cjs|mjs|js)$/.test(entry.name) &&
        !['package.json', 'package-lock.json', 'LICENSE', 'COPYING', 'NOTICE'].includes(
          entry.name,
        )) ||
      entry.name === 'localtone-release.json'
    )
      continue;
    const name = prefix + entry.name;
    if (entry.isDirectory())
      result.push(...(await sourceFiles(path.join(dir, entry.name), name + '/')));
    else if (entry.isFile()) result.push(name);
    else throw new Error('Source releases cannot contain symbolic links: ' + name);
  }
  return result;
}
const crcTable = Array.from({ length: 256 }, (_, i) => {
  for (let n = 0; n < 8; n++) i = i & 1 ? 0xedb88320 ^ (i >>> 1) : i >>> 1;
  return i >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
// Source archives are small. Native installers/archives are handled by builder.
export function sourceZip(entries) {
  const chunks = [],
    directory = [];
  let offset = 0;
  if (entries.length > 65535) throw new Error('Too many source files.');
  for (const item of entries) {
    const name = Buffer.from('Localtone/' + item.name),
      data = item.data;
    const compressed = deflateRawSync(data),
      crc = crc32(data),
      local = Buffer.alloc(30),
      central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(0x314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    chunks.push(local, name, compressed);
    directory.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const size = directory.reduce((n, b) => n + b.length, 0),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, ...directory, end]);
}
async function run(module, args) {
  const script =
    module === 'eslint/bin/eslint.js'
      ? path.join(path.dirname(require.resolve('eslint/package.json')), 'bin/eslint.js')
      : require.resolve(module);
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(module + ' exited with ' + code)),
    );
  });
}
async function verify() {
  await run('eslint/bin/eslint.js', ['.']);
  await run('prettier/bin/prettier.cjs', [
    '--check',
    '*.{cjs,mjs}',
    'app/**/*.{js,css,html}',
    'build/**/*.{cjs,mjs}',
  ]);
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test'], { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('Tests failed.'))));
  });
}
export async function main(args) {
  const target = args[0];
  if (!['source', 'mac', 'win', 'linux'].includes(target))
    throw new Error('Choose source, mac, win or linux.');
  if (
    target !== 'source' &&
    { mac: 'darwin', win: 'win32', linux: 'linux' }[target] !== process.platform
  )
    throw new Error('Build on the target operating system.');
  await verify();
  if (target === 'source') {
    const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    const files = await sourceFiles();
    const manifest = await createManifest(root, {
      version: pkg.version,
      kind: 'source',
      platform: 'any',
      arch: 'any',
      entry: 'main.cjs',
      files,
    });
    const text = JSON.stringify(manifest, null, 2) + '\n';
    await fs.writeFile(path.join(root, 'localtone-release.json'), text);
    const entries = await Promise.all(
      files.map(async (name) => ({ name, data: await fs.readFile(path.join(root, name)) })),
    );
    entries.push({ name: 'localtone-release.json', data: Buffer.from(text) });
    await fs.mkdir(path.join(root, 'dist'), { recursive: true });
    const out = path.join(root, 'dist', `Localtone-v${pkg.version.replace(/\.0$/, '')}-source.zip`);
    await fs.writeFile(out + '.tmp', sourceZip(entries));
    await fs.rename(out + '.tmp', out);
    await fs.writeFile(out + '.sha256', (await digest(out)) + '  ' + path.basename(out) + '\n');
    console.log('Source release:', out);
  } else {
    const options = ['--' + target, '--publish', 'never'];
    for (const arg of args.slice(1)) {
      if (['--x64', '--arm64', '--universal', '--dir'].includes(arg)) options.push(arg);
      else if (arg.startsWith('--electron-dist='))
        options.push('--config.electronDist=' + arg.slice('--electron-dist='.length));
      else throw new Error('Unknown release option: ' + arg);
    }
    await run('electron-builder/cli.js', options);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
