// Windows can round logical bounds when crossing native/DPI boundaries.
function boundsMatch(a, b) {
  return !!a && !!b && ['x', 'y', 'width', 'height'].every((key) => Math.abs(a[key] - b[key]) <= 2);
}
function createBoundsMemory() {
  let target = null,
    actual = null;
  return {
    capture(win) {
      const now = win.getBounds();
      return { ...(boundsMatch(now, actual) ? target : now) };
    },
    remember(win, bounds) {
      target = { ...bounds };
      actual = { ...win.getBounds() };
    },
  };
}
function createQueueWindow() {
  let prior = null,
    expanded = null,
    extension = 224;
  const normal = createBoundsMemory();
  return {
    open(win, screen, width = 224, resize = (target) => win.setBounds(target)) {
      if (prior) return true;
      if (win.isMaximized() || win.isFullScreen?.()) return false;
      const before = normal.capture(win),
        area = screen?.getDisplayMatching(before)?.workArea;
      if (
        !area ||
        before.width + width > area.width ||
        before.x + before.width + width > area.x + area.width
      )
        return false;
      prior = before;
      extension = width;
      const target = {
        ...before,
        width: before.width + width,
        x: before.x,
      };
      const finished = () => {
        expanded = { ...win.getBounds() };
        return true;
      };
      const result = resize(target);
      return result?.then ? result.then(finished) : finished();
    },
    close(win, resize = (target) => win.setBounds(target)) {
      if (!prior) return;
      const now = win.getBounds();
      if (win.isMaximized() || win.isFullScreen?.()) {
        prior = expanded = null;
        return;
      }
      const target = boundsMatch(now, expanded)
        ? prior
        : { ...now, width: Math.max(prior.width, now.width - extension) };
      const finished = () => {
        normal.remember(win, target);
        prior = expanded = null;
      };
      const result = resize(target);
      return result?.then ? result.then(finished) : finished();
    },
    normalBounds(win) {
      const now = win.getNormalBounds?.() || win.getBounds();
      if (!prior) return now;
      return boundsMatch(now, expanded)
        ? { ...prior }
        : { ...now, width: Math.max(prior.width, now.width - extension) };
    },
    get extended() {
      return !!prior;
    },
  };
}
module.exports = { createQueueWindow, createBoundsMemory };
