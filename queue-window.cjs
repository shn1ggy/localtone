function createQueueWindow() {
  let prior = null,
    expanded = null;
  return {
    open(win, screen, width = 224, resize = (target) => win.setBounds(target)) {
      if (prior) return true;
      if (win.isMaximized() || win.isFullScreen?.()) return false;
      const before = win.getBounds(),
        area = screen?.getDisplayMatching(before)?.workArea;
      if (!area || before.width + width > area.width) return false;
      prior = { ...before };
      expanded = {
        ...before,
        width: before.width + width,
        x: Math.max(area.x, Math.min(before.x, area.x + area.width - before.width - width)),
      };
      const result = resize(expanded);
      return result?.then ? result.then(() => true) : true;
    },
    close(win, resize = (target) => win.setBounds(target)) {
      if (!prior) return;
      let result;
      const now = win.getBounds();
      if (!win.isMaximized() && !win.isFullScreen?.()) {
        const unchanged = ['x', 'y', 'width', 'height'].every((k) => now[k] === expanded[k]);
        result = resize(
          unchanged
            ? prior
            : { ...now, width: Math.max(prior.width, now.width - (expanded.width - prior.width)) },
        );
      }
      prior = null;
      expanded = null;
      return result;
    },
    normalBounds(win) {
      const now = win.getNormalBounds?.() || win.getBounds();
      if (!prior) return now;
      const unchanged = ['x', 'y', 'width', 'height'].every((k) => now[k] === expanded[k]);
      return unchanged ? { ...prior } : { ...now, width: Math.max(prior.width, now.width - 224) };
    },
    get extended() {
      return !!prior;
    },
  };
}
module.exports = { createQueueWindow };
