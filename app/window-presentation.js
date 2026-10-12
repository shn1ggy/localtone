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
    if (!$('queue-panel').hidden) alignQueueClose();
  };
  window.addEventListener('resize', onResize);
  function paintFrame() {
    return new Promise((resolve) =>
      typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame(() =>
            fastNativeResize ? resolve() : window.requestAnimationFrame(resolve),
          )
        : resolve(),
    );
  }
  async function waitForViewport(result) {
    if (!result?.contentSize || typeof window.requestAnimationFrame !== 'function') return;
    const [width, height] = result.contentSize,
      start = Date.now();
    while (
      (Math.abs(window.innerWidth - width) > 1 || Math.abs(window.innerHeight - height) > 1) &&
      Date.now() - start < (fastNativeResize ? 120 : 500)
    )
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
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
        ? [{ transform: 'translateX(224px)' }, { transform: 'translateX(0)' }]
        : [{ transform: 'translateX(0)' }, { transform: 'translateX(224px)' }],
      { duration: show ? 180 : 140, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' },
    );
    try {
      await animation.finished;
    } finally {
      animation.cancel();
    }
    panel.style.transform = show ? '' : 'translateX(224px)';
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
        art = $('now-art'),
        style = document.documentElement.style;
      const size = {
        width: Math.round(sidebar.getBoundingClientRect().width),
        height: Math.round(
          player.getBoundingClientRect().height -
            parseFloat(window.getComputedStyle(player).paddingTop) +
            20,
        ),
        animate: false,
        report: true,
      };
      if (entering) {
        normalLayout = { width: window.innerWidth, height: window.innerHeight };
        style.setProperty(
          '--motion-player-footprint',
          `${player.getBoundingClientRect().height}px`,
        );
        for (const label of sidebar.querySelectorAll('.brand,.section-label')) {
          const computed = window.getComputedStyle(label);
          label.style.setProperty('--motion-margin-top', computed.marginTop);
          label.style.setProperty('--motion-margin-bottom', computed.marginBottom);
        }
        style.setProperty('--motion-player-width', `${player.getBoundingClientRect().width}px`);
        style.setProperty('--motion-art-size', `${art.getBoundingClientRect().width}px`);
        style.setProperty('--mini-width', `${size.width}px`);
      }
      const layout = normalLayout || { width: window.innerWidth, height: window.innerHeight };
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
          const width = window.innerWidth + (extend && !wasDocked ? 224 : 0);
          freezeLayout(width, window.innerHeight);
          document.body.classList.add('queue-extended');
          $('queue-panel').hidden = false;
          if (extend && !wasDocked && queueRevealEnabled())
            $('queue-panel').style.transform = 'translateX(224px)';
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
            alignQueueClose();
            if (docked && !wasDocked) await animateQueue(true);
            commit = () => {
              document.body.classList.toggle('queue-extended', !!docked && show);
              $('queue-panel').hidden = !show;
            };
          } finally {
            await finishLayout(() => {
              commit();
              $('queue-panel').style.transform = '';
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
    setQueueVisible,
    alignQueueClose,
    revealPlayingQueueItem,
    get transitioning() {
      return windowTransition;
    },
    dispose() {
      window.removeEventListener('resize', onResize);
    },
  };
}
