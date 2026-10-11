const fs = require('node:fs/promises');
const path = require('node:path');
const { promisify } = require('node:util');
const { execFile } = require('node:child_process');
const { digest } = require('../release.cjs');

// Inspect headers without executing a binary built for a different processor.
function binaryArchitectures(data) {
  const fail = () => {
    throw new Error('Unrecognized or truncated executable header.');
  };
  if (data.length < 20) return fail();
  if (data.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
    if (![1, 2].includes(data[5])) return fail();
    const machine = data[5] === 1 ? data.readUInt16LE(18) : data.readUInt16BE(18);
    return [{ 3: 'ia32', 62: 'x64', 183: 'arm64', 40: 'arm' }[machine] || `ELF-${machine}`];
  }
  if (data.toString('ascii', 0, 2) === 'MZ') {
    if (data.length < 64) return fail();
    const offset = data.readUInt32LE(60);
    if (offset > data.length - 6 || data.readUInt32LE(offset) !== 0x4550) return fail();
    const machine = data.readUInt16LE(offset + 4);
    return [{ 0x14c: 'ia32', 0x8664: 'x64', 0xaa64: 'arm64' }[machine] || `PE-${machine}`];
  }
  const magic = data.readUInt32BE(0);
  const cpu = (value) =>
    ({ 7: 'ia32', 0x1000007: 'x64', 12: 'arm', 0x100000c: 'arm64' })[value] || `MachO-${value}`;
  if ([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe].includes(magic))
    return [
      cpu([0xcefaedfe, 0xcffaedfe].includes(magic) ? data.readUInt32LE(4) : data.readUInt32BE(4)),
    ];
  if ([0xcafebabe, 0xbebafeca, 0xcafebabf, 0xbfbafeca].includes(magic)) {
    const little = [0xbebafeca, 0xbfbafeca].includes(magic);
    const read = (offset) => (little ? data.readUInt32LE(offset) : data.readUInt32BE(offset));
    const count = read(4),
      stride = [0xcafebabf, 0xbfbafeca].includes(magic) ? 32 : 20;
    if (!count || count > 32 || 8 + count * stride > data.length) return fail();
    return [...new Set(Array.from({ length: count }, (_, i) => cpu(read(8 + i * stride))))];
  }
  return fail();
}
async function inspectBinary(file, arch) {
  const handle = await fs.open(file, 'r');
  let architectures;
  try {
    const buffer = Buffer.alloc(256 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    architectures = binaryArchitectures(buffer.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
  const required = arch === 'universal' ? ['x64', 'arm64'] : [arch];
  if (required.some((item) => !architectures.includes(item)))
    throw new Error(
      `${path.basename(file)} processor mismatch: target ${arch}, binary ${architectures.join(', ')}. Install dependencies on the target processor before building.`,
    );
  return { architectures, sha256: await digest(file) };
}
async function packagedNotices(archive, installedRoot) {
  const asar = require('@electron/asar');
  // ASAR lists paths using the host separator. Use archive-relative POSIX
  // names for matching, notices and lockfile lookups on every platform.
  const names = asar
    .listPackage(archive)
    .map((name) => name.replaceAll('\\', '/').replace(/^\/+/, ''));
  const packages = [],
    texts = [];
  let installedPackages = {};
  if (installedRoot) {
    try {
      installedPackages =
        JSON.parse(await fs.readFile(path.join(installedRoot, 'package-lock.json'), 'utf8'))
          .packages || {};
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  for (const name of names
    .filter((name) => /(?:^|\/)node_modules\/(?:@[^/]+\/)?[^/]+\/package\.json$/.test(name))
    .sort()) {
    const pkg = JSON.parse(asar.extractFile(archive, name).toString());
    const dir = path.posix.dirname(name);
    const notices = names.filter(
      (file) =>
        path.posix.dirname(file) === dir &&
        /^(?:licen[cs]e|copying|notice)(?:[.-].*)?$/i.test(path.posix.basename(file)),
    );
    const additionalNotices = [];
    let noticeSourceUnavailable = false;
    if (installedRoot) {
      // Builder can flatten a nested runtime version over a different root/dev version.
      const candidates = [
        ...new Set([
          dir,
          ...Object.entries(installedPackages)
            .filter(
              ([location, metadata]) =>
                metadata.version === pkg.version &&
                (location === 'node_modules/' + pkg.name ||
                  location.endsWith('/node_modules/' + pkg.name)),
            )
            .map(([location]) => location),
        ]),
      ];
      let installed;
      for (const candidate of candidates) {
        if (
          candidate.split('/').some((part) => part === '..' || part === '.') ||
          candidate.includes('\\') ||
          path.isAbsolute(candidate)
        )
          continue;
        const location = path.join(installedRoot, ...candidate.split('/'));
        try {
          const metadata = JSON.parse(
            await fs.readFile(path.join(location, 'package.json'), 'utf8'),
          );
          if (metadata.name === pkg.name && metadata.version === pkg.version) {
            installed = location;
            break;
          }
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
      noticeSourceUnavailable = !installed;
      if (installed)
        for (const file of await fs.readdir(installed)) {
          if (
            !/^(?:licen[cs]e|copying|notice)(?:[.-].*)?$/i.test(file) ||
            notices.includes(dir + '/' + file)
          )
            continue;
          const location = path.join(installed, file);
          if (!(await fs.stat(location)).isFile()) continue;
          additionalNotices.push({
            path: dir + '/' + file,
            text: await fs.readFile(location, 'utf8'),
          });
        }
    }
    packages.push({
      name: pkg.name,
      version: pkg.version,
      license: pkg.license || pkg.licenses || 'Unspecified',
      path: dir,
      notices,
      additionalNotices: additionalNotices.map((item) => item.path),
      noticeSourceUnavailable,
    });
    texts.push(
      `\n=== ${pkg.name} ${pkg.version} ===\nDeclared license: ${JSON.stringify(pkg.license || pkg.licenses || 'Unspecified')}\n`,
    );
    for (const item of additionalNotices)
      texts.push(`\n--- Installed package notice: ${item.path} ---\n${item.text}\n`);
    for (const file of notices)
      texts.push(`\n--- ${file} ---\n${asar.extractFile(archive, file).toString()}\n`);
  }
  return {
    packages,
    text:
      'Localtone packaged dependency notices\nGenerated from the shipped app archive. This inventory is not a license compatibility or corresponding-source determination.\n' +
      texts.join(''),
  };
}
async function writePackageAudit({
  root,
  resources,
  entry,
  ffmpeg,
  arch,
  platform,
  version,
  electronVersion,
}) {
  const application = await inspectBinary(path.join(root, entry), arch);
  const decoder = await inspectBinary(path.join(root, ffmpeg), arch);
  if (platform !== process.platform || !decoder.architectures.includes(process.arch))
    throw new Error(
      'Run release packaging on the native target OS and processor so FFmpeg can be verified.',
    );
  const { stdout, stderr } = await promisify(execFile)(path.join(root, ffmpeg), ['-version'], {
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });
  decoder.versionOutput = (stdout + stderr).trim();
  if (!/^ffmpeg version /m.test(decoder.versionOutput))
    throw new Error('FFmpeg version verification failed.');
  const notices = await packagedNotices(
    path.join(root, resources, 'app.asar'),
    path.resolve(__dirname, '..'),
  );
  const ffmpegFolder = path.dirname(path.join(root, ffmpeg));
  for (const name of ['ffmpeg.LICENSE', 'ffmpeg.README']) {
    try {
      notices.text += `\n=== ${name} ===\n${await fs.readFile(path.join(ffmpegFolder, name), 'utf8')}\n`;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const report = {
    schema: 1,
    stage: 'afterPack-before-signing',
    version,
    platform,
    arch,
    electronVersion,
    application,
    ffmpeg: decoder,
    packages: notices.packages,
    packagesWithoutNotice: notices.packages
      .filter((item) => !item.notices.length && !item.additionalNotices.length)
      .map((item) => item.path),
    reviewRequired: [
      'Choose Localtone project license',
      'Verify exact FFmpeg corresponding-source distribution',
      'Review Electron/Chromium notices and every dependency license',
    ],
  };
  await fs.writeFile(
    path.join(root, resources, 'localtone-build-audit.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  await fs.writeFile(path.join(root, resources, 'THIRD-PARTY-NOTICES.txt'), notices.text);
  return ['localtone-build-audit.json', 'THIRD-PARTY-NOTICES.txt'].map(
    (name) => resources + '/' + name,
  );
}
module.exports = { binaryArchitectures, inspectBinary, packagedNotices, writePackageAudit };
