async function animateBounds(
  win,
  target,
  {
    duration = 240,
    now = () => Date.now(),
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  const initial = win.getBounds();
  if (!duration) {
    win.setBounds(target);
    return;
  }
  const began = now();
  let last = '';
  for (;;) {
    if (win.isDestroyed?.()) return;
    const t = Math.min(1, Math.max(0, (now() - began) / duration)),
      ease = t * t * (3 - 2 * t),
      bounds = Object.fromEntries(
        ['x', 'y', 'width', 'height'].map((key) => [
          key,
          Math.round(initial[key] + (target[key] - initial[key]) * ease),
        ]),
      ),
      signature = JSON.stringify(bounds);
    if (signature !== last) {
      win.setBounds(bounds);
      last = signature;
    }
    if (t === 1) break;
    await wait(16);
  }
}
module.exports = { animateBounds };
