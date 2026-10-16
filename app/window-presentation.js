// Owns mini/queue window presentation, never playback or collection state.
export function createWindowPresentation({
  window,
  document,
  api,
  getPreferences,
  syncPaneBounds,
  toast,
}) {
  const fastNativeResize = api.platform === 'win32';
  const $ = (id) => document.getElementById(id);
  let windowTransition = false,
    normalLayout = null,
    miniTransition = false;
  let queueBaseLayout = null,
    retainedLayout = null,
    queueWidth = 224;
  function viewportSize() {
    return {
      width: window.visualViewport?.width || window.innerWidth,
      height: window.visualViewport?.height || window.innerHeight,
    };
  }
  function layoutSize() {
    const bounds = document.querySelector('.shell')?.getBoundingClientRect();
    return bounds?.width && bounds?.height
      ? { width: bounds.width, height: bounds.height }
      : viewportSize();
  }
  function retainLayout(layout) {
    const shell = document.querySelector('.shell');
    if (!shell) return;
    retainedLayout = layout;
    shell.style.width = layout ? `${layout.width}px` : '';
    shell.style.height = layout ? `${layout.height}px` : '';
    document.documentElement.style.setProperty(
      '--player-bottom-offset',
      `${layout ? viewportSize().height - layout.height : 0}px`,
    );
  }
  function refreshPlayerLayout() {
    const player = document.querySelector('.sidebar-player');
    if (player && !windowTransition)
      document.documentElement.style.setProperty(
        '--player-footprint',
        `${player.getBoundingClientRect().height + 14}px`,
      );
  }
  const player = document.querySelector('.sidebar-player');
  const playerObserver =
    player && typeof window.ResizeObserver === 'function'
      ? new window.ResizeObserver(refreshPlayerLayout)
      : null;
  if (playerObserver) playerObserver.observe(player);
  function alignQueueClose() {
    const button = $('queue').getBoundingClientRect(),
      close = $('close-queue'),
      panel = $('queue-panel'),
      bounds = panel.getBoundingClientRect();
    panel.style.setProperty('--queue-heading-top', `${Math.max(0, button.top - bounds.top)}px`);
    panel.style.setProperty('--queue-heading-height', `${button.height || 30}px`);
    Object.assign(close.style, {
      position: document.body.classList.contains('queue-extended') ? 'absolute' : 'fixed',
      left: `${document.body.classList.contains('queue-extended') ? bounds.width - 12 - button.width : button.left}px`,
      top: `${document.body.classList.contains('queue-extended') ? button.top - bounds.top : button.top}px`,
      width: `${button.width}px`,
      height: `${button.height}px`,
    });
  }
  const onResize = () => {
    if (windowTransition && !document.body.classList.contains('player-transition'))
      document.documentElement.style.setProperty(
        '--player-bottom-offset',
        `${viewportSize().height - layoutSize().height}px`,
      );
    if (!windowTransition && !document.body.classList.contains('mini-player') && retainedLayout) {
      const viewport = viewportSize();
      // Native bounds may round by a pixel at fractional DPI. Keep the content stable;
      // an actual user resize releases the retained layout immediately.
      if (
        Math.abs(viewport.width - retainedLayout.width) > 2 ||
        Math.abs(viewport.height - retainedLayout.height) > 2
      ) {
        retainLayout(null);
        normalLayout = queueBaseLayout = null;
      }
    }
    if (!$('queue-panel').hidden) alignQueueClose();
  };
  window.addEventListener('resize', onResize);
  function paintFrame() {
    return new Promise((resolve) => {
      if (typeof window.requestAnimationFrame !== 'function') {
        resolve();
        return;
      }
      let frame, timer;
      const finish = () => {
        if (timer) window.clearTimeout(timer);
        if (frame) window.cancelAnimationFrame?.(frame);
        resolve();
      };
      // A partially offscreen/native-resizing Windows surface can throttle Chromium frames.
      // Give it one paint opportunity, without letting that throttle block window restoration.
      if (fastNativeResize) timer = window.setTimeout(finish, 32);
      frame = window.requestAnimationFrame(() => {
        if (fastNativeResize) finish();
        else frame = window.requestAnimationFrame(finish);
      });
    });
  }
  async function waitForViewport(result) {
    if (!result?.contentSize || typeof window.requestAnimationFrame !== 'function') return;
    const [width, height] = result.contentSize,
      start = Date.now();
    while (
      (Math.abs(window.innerWidth - width) > 1 || Math.abs(window.innerHeight - height) > 1) &&
      Date.now() - start < (fastNativeResize ? 120 : 500)
    )
      await paintFrame();
  }
  function motionValue(result) {
    return result && typeof result === 'object' && 'value' in result ? result.value : result;
  }
  function motionEnabled() {
    return !fastNativeResize && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }
  function queueRevealEnabled() {
    return fastNativeResize && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }
  async function animateQueue(show) {
    const panel = $('queue-panel');
    if (!queueRevealEnabled() || typeof panel.animate !== 'function') return;
    const animation = panel.animate(
      show
        ? [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }]
        : [{ clipPath: 'inset(0 0% 0 0)' }, { clipPath: 'inset(0 100% 0 0)' }],
      { duration: show ? 180 : 140, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' },
    );
    try {
      await animation.finished;
    } finally {
      animation.cancel();
    }
    panel.style.clipPath = show ? '' : 'inset(0 100% 0 0)';
  }
  function freezeLayout(width, height, { player = false } = {}) {
    windowTransition = true;
    const style = document.documentElement.style;
    style.setProperty('--motion-width', `${width}px`);
    style.setProperty('--motion-height', `${height}px`);
    document.body.classList.add('window-transition');
    if (player) document.body.classList.add('player-transition');
  }
  async function finishLayout(commit = () => {}) {
    await paintFrame();
    commit();
    const mini = document.body.classList.contains('mini-player');
    const base = queueBaseLayout || normalLayout;
    retainLayout(
      mini || !base
        ? null
        : {
            width:
              base.width + (document.body.classList.contains('queue-extended') ? queueWidth : 0),
            height: base.height,
          },
    );
    document.body.classList.remove('window-transition', 'player-transition');
    windowTransition = false;
    syncPaneBounds();
    if (!$('queue-panel').hidden) alignQueueClose();
  }
  async function toggleMini() {
    if (miniTransition || windowTransition) return;
    miniTransition = true;
    const entering = !document.body.classList.contains('mini-player');
    try {
      if (!$('queue-panel').hidden) await setQueueVisible(false);
      const sidebar = document.querySelector('.sidebar'),
        player = document.querySelector('.sidebar-player'),
        style = document.documentElement.style;
      const size = {
        width: Math.round(sidebar.getBoundingClientRect().width),
        height: Math.ceil(player.getBoundingClientRect().height + 20),
        animate: false,
        report: true,
      };
      if (entering) {
        normalLayout = layoutSize();
        style.setProperty('--mini-width', `${size.width}px`);
      }
      const layout = normalLayout || layoutSize();
      freezeLayout(layout.width, layout.height, { player: true });
      document.body.classList.remove('mini-player');
      await paintFrame();
      const result = await api.windowAction('mini', size);
      await waitForViewport(result);
      const active = motionValue(result);
      document.body.classList.toggle('mini-player', !!active);
      await finishLayout();
    } catch (error) {
      document.body.classList.toggle('mini-player', !entering);
      await finishLayout();
      toast(error.message);
    } finally {
      miniTransition = false;
    }
  }

  function revealPlayingQueueItem() {
    const list = $('queue-list'),
      row = list.querySelector('.active');
    list.style.paddingBottom = '12px';
    if (!row) {
      list.scrollTop = 0;
      return;
    }
    list.scrollTop += row.getBoundingClientRect().top - list.getBoundingClientRect().top;
  }

  let queueWindowJobs = Promise.resolve();
  let queueRequested = false;
  function setQueueVisible(show) {
    if (show && document.body.classList.contains('mini-player')) return Promise.resolve();
    queueRequested = show;
    const wasExtended = document.body.classList.contains('queue-extended');
    if (!wasExtended) {
      $('queue-panel').hidden = !show;
      if (show) {
        alignQueueClose();
        revealPlayingQueueItem();
      }
    }
    queueWindowJobs = queueWindowJobs
      .then(async () => {
        if (show !== queueRequested) return;
        const extend = show && getPreferences().queuePresentation === 'extend',
          wasDocked = document.body.classList.contains('queue-extended');
        if (extend || wasDocked) {
          const viewport = layoutSize();
          if (extend && !wasDocked) {
            queueBaseLayout = viewport;
            queueWidth = 224;
          }
          document.documentElement.style.setProperty('--queue-width', `${queueWidth}px`);
          freezeLayout(viewport.width + (extend && !wasDocked ? queueWidth : 0), viewport.height);
          document.body.classList.add('queue-extended');
          $('queue-panel').hidden = false;
          if (extend && !wasDocked && queueRevealEnabled())
            $('queue-panel').style.clipPath = 'inset(0 100% 0 0)';
          alignQueueClose();
          await paintFrame();
          let commit = () => {
            document.body.classList.toggle('queue-extended', wasDocked);
            $('queue-panel').hidden = !wasDocked;
          };
          try {
            if (!extend && wasDocked) await animateQueue(false);
            const result = await api.windowAction?.(extend ? 'queue-open' : 'queue-close', {
              animate: motionEnabled(),
              report: true,
            });
            await waitForViewport(result);
            const docked = extend && motionValue(result);
            if (docked && queueBaseLayout) {
              const actual = viewportSize(),
                delta = actual.width - queueBaseLayout.width;
              if (delta > 200 && delta < 250) {
                queueWidth = delta;
                // Commit both quantities together: the existing main pane never gains/loses a pixel.
                document.documentElement.style.setProperty('--queue-width', `${queueWidth}px`);
                document.documentElement.style.setProperty('--motion-width', `${actual.width}px`);
              }
            }
            alignQueueClose();
            if (docked && !wasDocked) await animateQueue(true);
            commit = () => {
              document.body.classList.toggle('queue-extended', !!docked && show);
              $('queue-panel').hidden = !show;
            };
          } finally {
            await finishLayout(() => {
              commit();
              $('queue-panel').style.clipPath = '';
            });
          }
        } else {
          $('queue-panel').hidden = !show;
          document.body.classList.remove('queue-extended');
          await api.windowAction?.('queue-close');
          syncPaneBounds();
        }
        if (show) {
          alignQueueClose();
          revealPlayingQueueItem();
        }
      })
      .catch(async (error) => {
        await finishLayout();
        toast(error.message);
      });
    return queueWindowJobs;
  }

  return {
    toggleMini,
    refreshPlayerLayout,
    get queueWidth() {
      return queueWidth;
    },
    setQueueVisible,
    alignQueueClose,
    revealPlayingQueueItem,
    get transitioning() {
      return windowTransition;
    },
    dispose() {
      window.removeEventListener('resize', onResize);
      playerObserver?.disconnect();
    },
  };
}
