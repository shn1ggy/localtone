import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { verifyDownloads } from './verify-downloads.mjs';
const plan = JSON.parse(await fs.readFile(new URL('./release-plan.json', import.meta.url)));
if (
  plan.repository !== 'shn1ggy/localtone' ||
  !/^\d+\.\d+\.\d+$/.test(plan.version) ||
  !/^[a-f0-9]{40}$/.test(plan.commit) ||
  !Number.isSafeInteger(plan.buildRun) ||
  plan.buildRun < 1 ||
  plan.tag !== 'v' + plan.version
)
  throw Error('Invalid release plan.');
// Numeric 0.x releases remain early access; 1.x and later are stable.
const prerelease = plan.version.startsWith('0.');
const makeLatest = prerelease ? 'false' : 'true';
const token = process.env.GH_TOKEN;
if (!token) throw Error('GitHub job token is required.');
const base = 'https://api.github.com/repos/' + plan.repository;
async function api(url, method = 'GET', body, extra = {}) {
  if (
    new URL(url).protocol !== 'https:' ||
    !['api.github.com', 'uploads.github.com'].includes(new URL(url).hostname)
  )
    throw Error('Unexpected GitHub API destination.');
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...extra.headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    ...extra,
  });
  if (!response.ok)
    throw Error(`GitHub ${method} failed (${response.status}): ${await response.text()}`);
  return response.json();
}
async function verifiedBuild(wait) {
  for (let attempt = 0; attempt < (wait ? 72 : 1); attempt++) {
    const run = await api(base + '/actions/runs/' + plan.buildRun);
    if (run.head_sha !== plan.commit || run.head_branch !== 'main' || run.event !== 'push')
      throw Error('Build identity does not match the approved release.');
    if (run.status === 'completed') {
      if (run.conclusion !== 'success')
        throw Error('Release build did not succeed: ' + run.conclusion);
      return;
    }
    console.log('Waiting for native package verification:', run.status);
    await new Promise((resolve) => setTimeout(resolve, 25000));
  }
  throw Error('Native package verification has not completed.');
}
await verifiedBuild(process.argv.includes('--wait'));
if (process.argv.includes('--wait') && process.env.GITHUB_OUTPUT)
  await fs.appendFile(process.env.GITHUB_OUTPUT, `commit=${plan.commit}\nrun=${plan.buildRun}\n`);
if (!process.argv.includes('--wait')) {
  const directory = path.resolve(process.argv[2] || 'release-candidate');
  const old = JSON.parse(await fs.readFile(path.join(directory, 'checksums.json'), 'utf8'));
  const sourceName = 'Localtone-v' + plan.version.replace(/\.0$/, '') + '-source.zip';
  const source = path.join(directory, sourceName);
  const sourceBytes = await fs.readFile(source);
  if (!old.artifacts.some((item) => item.name === sourceName)) {
    old.artifacts.push({
      name: sourceName,
      size: sourceBytes.length,
      sha256: createHash('sha256').update(sourceBytes).digest('hex'),
    });
    old.artifacts.sort((a, b) => a.name.localeCompare(b.name));
    await fs.writeFile(path.join(directory, 'checksums.json'), JSON.stringify(old, null, 2) + '\n');
    await fs.writeFile(
      path.join(directory, 'SHA256SUMS.txt'),
      old.artifacts.map((a) => a.sha256 + '  ' + a.name).join('\n') + '\n',
    );
  }
  const names = await verifyDownloads(path.join(directory, 'checksums.json'));
  for (const name of [
    `Localtone-${plan.version}-mac-arm64.zip`,
    `Localtone-${plan.version}-mac-x64.zip`,
    `Localtone-${plan.version}-win-x64.zip`,
    `Localtone-${plan.version}-linux-x64.zip`,
    ...['darwin-arm64', 'darwin-x64', 'win32-x64', 'linux-x64'].map(
      (target) => `Localtone-${plan.version}-ffmpeg-source-${target}.tar.gz`,
    ),
  ])
    if (!names.includes(name)) throw Error('Missing required release file: ' + name);
  const releases = await api(base + '/releases');
  let release = releases.find((item) => item.tag_name === plan.tag);
  const body = await fs.readFile(
    new URL('./release-notes-' + plan.version.replace(/\.0$/, '') + '.md', import.meta.url),
    'utf8',
  );
  const metadata = {
    tag_name: plan.tag,
    target_commitish: plan.commit,
    name: plan.title,
    body,
    draft: true,
    prerelease,
    make_latest: makeLatest,
  };
  if (!release) release = await api(base + '/releases', 'POST', metadata);
  else if (release.draft) release = await api(base + '/releases/' + release.id, 'PATCH', metadata);
  else throw Error('This release is already published; refusing to modify it.');
  const all = [...names, 'checksums.json', 'SHA256SUMS.txt'];
  for (const name of all) {
    const file = path.join(directory, name),
      stat = await fs.stat(file);
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    const sha256 = hash.digest('hex');
    const existing = release.assets.find((item) => item.name === name);
    if (existing) {
      if (existing.size !== stat.size || existing.digest !== 'sha256:' + sha256)
        throw Error('Existing draft asset differs; refusing to overwrite: ' + name);
      continue;
    }
    const url = release.upload_url.replace(/\{.*$/, '') + '?name=' + encodeURIComponent(name);
    const asset = await api(url, 'POST', undefined, {
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(stat.size),
      },
      body: createReadStream(file),
      duplex: 'half',
    });
    if (asset.size !== stat.size || asset.digest !== 'sha256:' + sha256)
      throw Error('Uploaded asset integrity mismatch: ' + name);
    console.log('Uploaded and verified:', name);
  }
  const assets = await api(base + '/releases/' + release.id + '/assets');
  if (all.some((name) => !assets.some((asset) => asset.name === name)))
    throw Error('Release assets are incomplete.');
  const published = await api(base + '/releases/' + release.id, 'PATCH', {
    draft: false,
    prerelease,
    make_latest: makeLatest,
  });
  if (published.draft || published.prerelease !== prerelease)
    throw Error('Unexpected release publication state.');
  console.log(
    `Published verified ${prerelease ? 'early-access' : 'stable'} release:`,
    published.html_url,
  );
}
