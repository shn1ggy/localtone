const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const repository = 'shn1ggy/localtone';
const maxDownload = 2 * 1024 ** 3;
function versionParts(value) {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value || '');
  if (!match) throw new Error('The release has an unsupported version.');
  return match.slice(1).map(Number);
}
function newerVersion(candidate, current) {
  const a = versionParts(candidate),
    b = versionParts(current);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
function trustedURL(value) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    ![
      'api.github.com',
      'github.com',
      'release-assets.githubusercontent.com',
      'objects.githubusercontent.com',
    ].includes(url.hostname)
  )
    throw new Error('The release contains an untrusted download address.');
  return url.href;
}
// Node fetch exposes manual redirects; Electron net.fetch cancels them instead.
function createOnlineUpdates({
  fetch = globalThis.fetch,
  version,
  platform,
  arch,
  progress = () => {},
}) {
  let controller = null,
    candidate = null;
  let completion = Promise.resolve();
  async function request(url, signal) {
    for (let i = 0; i < 6; i++) {
      const response = await fetch(trustedURL(url), {
        signal,
        redirect: 'manual',
        headers: { 'User-Agent': `Localtone/${version}`, Accept: 'application/vnd.github+json' },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) throw new Error('The release download redirect is invalid.');
        url = new URL(location, url).href;
        continue;
      }
      if (response.status === 404)
        throw new Error(
          'No public release is available. The repository may be private or have no published releases.',
        );
      if (response.status === 403 || response.status === 429)
        throw new Error('GitHub temporarily limited update requests. Try again later.');
      if (!response.ok)
        throw new Error(`GitHub request failed (${response.status}). Try again later.`);
      return response;
    }
    throw new Error('Too many release download redirects.');
  }
  async function bytes(url, signal, limit) {
    const response = await request(url, signal);
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > limit) throw new Error('The release metadata is too large.');
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  async function operation(task, timeout) {
    if (controller) throw new Error('An update operation is already running.');
    controller = new AbortController();
    const active = controller;
    let finish;
    completion = new Promise((resolve) => {
      finish = resolve;
    });
    const timer = setTimeout(
      () => active.abort(new Error('The update request timed out. Try again.')),
      timeout,
    );
    try {
      return await task(active.signal);
    } catch (error) {
      if (active.signal.aborted) {
        if (active.signal.reason?.message === 'cancelled') return { cancelled: true };
        throw active.signal.reason;
      }
      throw error;
    } finally {
      clearTimeout(timer);
      controller = null;
      finish();
    }
  }
  async function check() {
    return operation(async (signal) => {
      candidate = null;
      // GitHub's /latest endpoint deliberately excludes prereleases. Localtone 0.x
      // is early access, so use the published feed and compare numeric versions.
      const releases = JSON.parse(
        await bytes(
          `https://api.github.com/repos/${repository}/releases?per_page=100`,
          signal,
          4 * 1024 ** 2,
        ),
      );
      if (!Array.isArray(releases)) throw new Error('GitHub returned invalid release metadata.');
      const earlyAccess = versionParts(version)[0] === 0;
      const published = releases.filter(
        (item) =>
          item &&
          !item.draft &&
          (earlyAccess || !item.prerelease) &&
          /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(item.tag_name || ''),
      );
      published.sort((a, b) =>
        newerVersion(a.tag_name, b.tag_name) ? -1 : newerVersion(b.tag_name, a.tag_name) ? 1 : 0,
      );
      const release = published[0];
      if (!release)
        throw new Error(
          earlyAccess
            ? 'No published Localtone release is available yet.'
            : 'No stable Localtone release is available yet.',
        );
      const next = release.tag_name;
      if (!newerVersion(next, version)) return { available: false, version };
      const os = { darwin: 'mac', win32: 'win', linux: 'linux' }[platform];
      if (!os || !['x64', 'arm64'].includes(arch))
        throw new Error('No update build is available for this system.');
      const name = `Localtone-${next.replace(/^v/, '')}-${os}-${arch}.zip`;
      const assets = Array.isArray(release.assets) ? release.assets : [];
      const matches = assets.filter((asset) => asset.name === name);
      const sums = assets.filter((asset) => asset.name === 'checksums.json');
      if (matches.length !== 1 || sums.length !== 1)
        throw new Error('This release has no compatible verified desktop archive.');
      const asset = matches[0];
      if (!Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > maxDownload)
        throw new Error('The release download size is invalid.');
      const manifest = JSON.parse(
        await bytes(trustedURL(sums[0].browser_download_url), signal, 1024 ** 2),
      );
      const records =
        manifest.schema === 1 && Array.isArray(manifest.artifacts)
          ? manifest.artifacts.filter((item) => item.name === name)
          : [];
      if (
        records.length !== 1 ||
        records[0].size !== asset.size ||
        !/^[a-f0-9]{64}$/.test(records[0].sha256)
      )
        throw new Error('The release checksum is missing or invalid.');
      signal.throwIfAborted();
      candidate = {
        name,
        size: asset.size,
        url: trustedURL(asset.browser_download_url),
        sha256: records[0].sha256,
        version: next.replace(/^v/, ''),
        notes: String(release.body || '').slice(0, 20000),
      };
      return {
        available: true,
        name,
        size: candidate.size,
        version: candidate.version,
        notes: candidate.notes,
      };
    }, 30000);
  }
  async function download(destination, expectedName) {
    if (!candidate) throw new Error('Check for updates before downloading.');
    if (expectedName && candidate.name !== expectedName)
      throw new Error('The selected release changed. Check for updates again.');
    const selected = { ...candidate };
    return operation(
      async (signal) => {
        const temporary = path.join(
          path.dirname(destination),
          `.localtone-download-${randomUUID()}.part`,
        );
        let file;
        try {
          file = await fs.open(temporary, 'wx', 0o600);
          progress({ received: 0, total: selected.size });
          const response = await request(selected.url, signal);
          const hash = createHash('sha256');
          let received = 0,
            lastReport = 0;
          progress({ received, total: selected.size });
          for await (const chunk of response.body) {
            signal.throwIfAborted();
            received += chunk.length;
            if (received > selected.size)
              throw new Error('The download exceeds its expected size.');
            hash.update(chunk);
            await file.writeFile(chunk);
            if (Date.now() - lastReport >= 100) {
              progress({ received, total: selected.size });
              lastReport = Date.now();
            }
          }
          if (received !== selected.size || hash.digest('hex') !== selected.sha256)
            throw new Error(
              'Download verification failed. Nothing was installed. Try downloading again.',
            );
          signal.throwIfAborted();
          await file.sync();
          await file.close();
          file = null;
          // Publish atomically on the same filesystem; never overwrite another file/link.
          try {
            await fs.link(temporary, destination);
          } catch (error) {
            if (error.code === 'EEXIST')
              throw new Error(
                'A file already exists at that location. Choose a different download filename.',
              );
            throw error;
          }
          progress({ received, total: selected.size });
          return { file: destination, version: selected.version };
        } finally {
          if (file) await file.close();
          await fs.rm(temporary, { force: true });
        }
      },
      10 * 60 * 1000,
    );
  }
  const cancel = () => controller?.abort(new Error('cancelled'));
  return {
    check,
    download,
    cancel,
    shutdown: async () => {
      cancel();
      await completion;
    },
  };
}
module.exports = { createOnlineUpdates, newerVersion, trustedURL };
