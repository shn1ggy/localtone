import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

export async function verifyDownloads(manifestPath) {
  const root = path.dirname(path.resolve(manifestPath));
  const raw = await fs.readFile(manifestPath, 'utf8');
  let artifacts;
  if (path.extname(manifestPath).toLowerCase() === '.json') {
    const report = JSON.parse(raw);
    if (report.schema !== 1 || !Array.isArray(report.artifacts))
      throw new Error('Invalid checksum manifest.');
    artifacts = report.artifacts;
  } else {
    artifacts = raw
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
        if (!match) throw new Error('Invalid SHA-256 checksum line.');
        return { sha256: match[1], name: match[2] };
      });
  }
  if (!artifacts.length || artifacts.length > 1000) throw new Error('Invalid artifact count.');
  const seen = new Set();
  for (const item of artifacts) {
    if (
      !item ||
      typeof item.name !== 'string' ||
      !item.name ||
      /[/\\\x00-\x1f]/.test(item.name) ||
      ['.', '..'].includes(item.name) ||
      /[:]/.test(item.name) ||
      seen.has(item.name.toLowerCase()) ||
      !/^[a-f0-9]{64}$/.test(item.sha256)
    )
      throw new Error('Invalid or duplicate artifact name/checksum.');
    seen.add(item.name.toLowerCase());
    const file = path.join(root, item.name);
    const stat = await fs.lstat(file);
    if (
      !stat.isFile() ||
      (item.size !== undefined &&
        (!Number.isSafeInteger(item.size) || item.size < 1 || stat.size !== item.size))
    )
      throw new Error('File size/type verification failed: ' + item.name);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    if (hash.digest('hex') !== item.sha256)
      throw new Error('Checksum verification failed: ' + item.name);
  }
  return artifacts.map((item) => item.name);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file || process.argv.length !== 3) {
    console.error(
      'Usage: node build/verify-downloads.mjs PATH/TO/checksums.json (or SHA256SUMS.txt / source.zip.sha256)',
    );
    process.exitCode = 1;
  } else {
    verifyDownloads(file)
      .then((names) =>
        console.log('Verified ' + names.length + ' download(s):\n' + names.join('\n')),
      )
      .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
      });
  }
}
