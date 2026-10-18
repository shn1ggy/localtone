const fs = require('node:fs/promises');
const path = require('node:path');
const { createManifest, digest } = require('../src/release.cjs');
const { writePackageAudit } = require('./package-audit.cjs');

exports.afterPack = async (context) => {
  const platform = context.electronPlatformName;
  const name = context.packager.appInfo.productFilename;
  const root =
    platform === 'darwin' ? path.join(context.appOutDir, name + '.app') : context.appOutDir;
  const resources = platform === 'darwin' ? 'Contents/Resources' : 'resources';
  const files = [resources + '/app.asar'];
  const ffmpeg =
    resources +
    '/app.asar.unpacked/node_modules/ffmpeg-static/' +
    (platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  await fs.access(path.join(root, ffmpeg));
  files.push(ffmpeg);
  const entry =
    platform === 'darwin'
      ? `Contents/MacOS/${name}`
      : platform === 'win32'
        ? name + '.exe'
        : context.packager.executableName;
  const arch = require('builder-util').Arch[context.arch];
  files.push(
    ...(await writePackageAudit({
      root,
      resources,
      entry,
      ffmpeg,
      arch,
      platform,
      version: context.packager.appInfo.version,
      electronVersion:
        context.packager.config.electronVersion || require('electron/package.json').version,
    })),
  );
  const manifest = await createManifest(root, {
    version: context.packager.appInfo.version,
    kind: 'desktop',
    platform,
    arch,
    entry,
    files,
  });
  await fs.writeFile(
    path.join(root, resources, 'localtone-release.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
};
exports.afterAllArtifactBuild = async (result) => {
  const items = [];
  const sourceArchives = (await fs.readdir(result.outDir))
    .filter((name) => /^Localtone-.*-ffmpeg-source-.*\.tar\.gz$/.test(name))
    .map((name) => path.join(result.outDir, name));
  for (const file of [...result.artifactPaths, ...sourceArchives]) {
    const stat = await fs.stat(file);
    if (!stat.isFile()) continue;
    items.push({ name: path.basename(file), size: stat.size, sha256: await digest(file) });
  }
  await fs.writeFile(
    path.join(result.outDir, 'checksums.json'),
    JSON.stringify({ schema: 1, artifacts: items }, null, 2) + '\n',
  );
  await fs.writeFile(
    path.join(result.outDir, 'SHA256SUMS.txt'),
    items.map((item) => item.sha256 + '  ' + item.name).join('\n') + '\n',
  );
  return [];
};
