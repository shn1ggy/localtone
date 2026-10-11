import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { verifyDownloads } from './verify-downloads.mjs';
const { digest } = createRequire(import.meta.url)('../release.cjs');
export async function assembleDownloads(input, output) {
  const folders = await fs.readdir(input, { withFileTypes: true });
  const records = [],
    seen = new Set();
  let version;
  for (const folder of folders) {
    if (!folder.isDirectory() || folder.isSymbolicLink())
      throw Error('Expected separate platform artifact folders.');
    const root = path.join(input, folder.name);
    const names = await verifyDownloads(path.join(root, 'checksums.json'));
    for (const name of names) {
      const match =
        /^Localtone-(\d+\.\d+\.\d+)-linux-(x86_64|aarch64)\.AppImage(?:\.blockmap)?$/.exec(name) ||
        /^Localtone-(\d+\.\d+\.\d+)-(mac|win|linux)-(x64|arm64)\.(zip|AppImage)(?:\.blockmap)?$/.exec(
          name,
        ) ||
        /^Localtone-(\d+\.\d+\.\d+)-windows-(x64|arm64)-portable\.exe(?:\.blockmap)?$/.exec(name);
      const sourceMatch =
        /^Localtone-(\d+\.\d+\.\d+)-ffmpeg-source-(darwin|win32|linux)-(x64|arm64)\.tar\.gz$/.exec(
          name,
        );
      const accepted = match || sourceMatch;
      if (!accepted || seen.has(name))
        throw Error('Unexpected or duplicate release artifact: ' + name);
      version ||= accepted[1];
      if (accepted[1] !== version) throw Error('Release artifacts have different versions.');
      seen.add(name);
      records.push({ name, source: path.join(root, name) });
    }
  }
  if (!records.length) throw Error('No release artifacts.');
  // A new output directory prevents overwriting existing release candidates.
  await fs.mkdir(output);
  try {
    const artifacts = [];
    for (const item of records) {
      const target = path.join(output, item.name);
      await fs.copyFile(item.source, target, fs.constants.COPYFILE_EXCL);
      artifacts.push({
        name: item.name,
        size: (await fs.stat(target)).size,
        sha256: await digest(target),
      });
    }
    artifacts.sort((a, b) => a.name.localeCompare(b.name));
    await fs.writeFile(
      path.join(output, 'checksums.json'),
      JSON.stringify({ schema: 1, artifacts }, null, 2) + '\n',
    );
    await fs.writeFile(
      path.join(output, 'SHA256SUMS.txt'),
      artifacts.map((a) => a.sha256 + '  ' + a.name).join('\n') + '\n',
    );
    await verifyDownloads(path.join(output, 'checksums.json'));
    return artifacts;
  } catch (error) {
    await fs.rm(output, { recursive: true, force: true });
    throw error;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) {
    console.error('Usage: node build/assemble-downloads.mjs INPUT_FOLDERS NEW_OUTPUT_FOLDER');
    process.exitCode = 1;
  } else
    assembleDownloads(process.argv[2], process.argv[3])
      .then((items) => console.log('Verified release candidate: ' + items.length + ' artifacts'))
      .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
      });
}
