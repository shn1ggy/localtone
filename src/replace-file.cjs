const fs = require('node:fs/promises');
// On Windows, replacing a file fails with EPERM/EACCES/EBUSY while another program
// briefly holds it open: Dropbox, OneDrive or an antivirus scanner reading the
// freshly written file. Those locks clear within milliseconds to a few seconds, so the
// rename is retried with a short backoff before the error is reported.
const transient = new Set(['EPERM', 'EACCES', 'EBUSY']);
async function replaceFile(
  from,
  to,
  {
    attempts = 12,
    wait = (ms) => new Promise((r) => setTimeout(r, ms)),
    beforeRename = async () => {},
  } = {},
) {
  for (let attempt = 1; ; attempt++) {
    await beforeRename();
    try {
      return await fs.rename(from, to);
    } catch (error) {
      if (!transient.has(error.code) || attempt >= attempts) throw error;
      // 20, 40, 80 … ms, capped at 500 ms: about four seconds in total.
      await wait(Math.min(500, 20 * 2 ** (attempt - 1)));
    }
  }
}
// Synchronous variant for the quit-time session saves; waits at most about one second.
function replaceFileSync(from, to, attempts = 8) {
  const sync = require('node:fs'),
    pause = new Int32Array(new SharedArrayBuffer(4));
  for (let attempt = 1; ; attempt++) {
    try {
      return sync.renameSync(from, to);
    } catch (error) {
      if (!transient.has(error.code) || attempt >= attempts) throw error;
      Atomics.wait(pause, 0, 0, Math.min(250, 10 * 2 ** (attempt - 1)));
    }
  }
}
module.exports = { replaceFile, replaceFileSync };
