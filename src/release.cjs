const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createReadStream } = require('node:fs');

const appId = 'com.localtone.player';
async function digest(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
function relativeFile(root, name) {
  if (typeof name !== 'string' || !name || name.includes('\\') || name.includes('\0'))
    throw new Error('Invalid release file path.');
  const parts = name.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..') || path.isAbsolute(name))
    throw new Error('Invalid release file path.');
  return path.join(root, ...parts);
}
function compareVersions(a, b) {
  const parse = (v) => {
    if (typeof v !== 'string' || !/^\d+\.\d+\.\d+$/.test(v))
      throw new Error('Use a stable Localtone release.');
    const parts = v.split('.').map(Number);
    if (parts.some((n) => !Number.isSafeInteger(n))) throw new Error('Invalid release version.');
    return parts;
  };
  const x = parse(a),
    y = parse(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return Math.sign(x[i] - y[i]);
  return 0;
}
async function createManifest(root, { version, kind, platform, arch, entry, files }) {
  const hashes = {};
  for (const name of files) hashes[name] = await digest(relativeFile(root, name));
  return { schema: 1, appId, version, kind, platform, arch, entry, files: hashes };
}
async function inspectRelease(
  selected,
  current,
  { platform = process.platform, arch = process.arch } = {},
) {
  const selectedRoot = await fs.realpath(selected);
  const candidates = [
    ['localtone-release.json', 'source'],
    ['resources/localtone-release.json', 'desktop'],
    ['Contents/Resources/localtone-release.json', 'desktop'],
  ];
  let manifest;
  for (const [name, kind] of candidates) {
    try {
      manifest = JSON.parse(await fs.readFile(relativeFile(selectedRoot, name), 'utf8'));
      if (manifest.kind !== kind) throw new Error('Invalid release type.');
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (!manifest || manifest.schema !== 1 || manifest.appId !== appId)
    throw new Error('Choose an extracted Localtone release, or its Localtone.app bundle.');
  if (compareVersions(manifest.version, current) <= 0)
    throw new Error('Choose a newer Localtone version.');
  if (
    manifest.kind === 'desktop' &&
    (manifest.platform !== platform ||
      (manifest.arch !== arch && !(platform === 'darwin' && manifest.arch === 'universal')))
  )
    throw new Error('This release is for a different operating system or processor.');
  if (!manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files))
    throw new Error('Invalid release checksums.');
  const entries = Object.entries(manifest.files);
  if (!entries.length || entries.length > 500) throw new Error('Invalid release checksums.');
  const required =
    manifest.kind === 'source'
      ? ['package.json', 'main.cjs', 'app/index.html']
      : [platform === 'darwin' ? 'Contents/Resources/app.asar' : 'resources/app.asar'];
  for (const name of required)
    if (!Object.hasOwn(manifest.files, name))
      throw new Error('The release is missing required files.');
  for (const [name, expected] of entries) {
    if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected))
      throw new Error('Invalid release checksum.');
    const file = relativeFile(selectedRoot, name),
      actual = await fs.realpath(file);
    if (!actual.startsWith(selectedRoot + path.sep) || !(await fs.stat(actual)).isFile())
      throw new Error('Release files must stay inside the app folder.');
    if ((await digest(actual)) !== expected)
      throw new Error('Release verification failed: ' + name);
  }
  if (manifest.kind === 'source') {
    const pkg = JSON.parse(await fs.readFile(path.join(selectedRoot, 'package.json'), 'utf8'));
    if (pkg.name !== 'localtone' || pkg.version !== manifest.version)
      throw new Error('The app version does not match its release manifest.');
  }
  const entry = relativeFile(selectedRoot, manifest.entry);
  const actualEntry = await fs.realpath(entry);
  if (!actualEntry.startsWith(selectedRoot + path.sep) || !(await fs.stat(actualEntry)).isFile())
    throw new Error('The application entry point is missing.');
  const dataRoot =
    manifest.kind === 'desktop' && platform === 'darwin'
      ? path.dirname(selectedRoot)
      : selectedRoot;
  return { manifest, root: selectedRoot, dataRoot, entry };
}
module.exports = { appId, digest, relativeFile, compareVersions, createManifest, inspectRelease };
