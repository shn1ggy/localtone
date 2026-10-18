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
    queueWidth = 224,
    // Queue state parked while the mini player is shown; restored on leaving mini.
    heldQueue = null;
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
  // Renderer-side geometry sent with window actions (logged by source builds only).
  function geometry() {
    const rect = (selector) => {
      const r = document.querySelector(selector)?.getBoundingClientRect();
      return r ? [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 100) / 100) : null;
    };
    return {
      viewport: viewportSize(),
      retained: retainedLayout,
      offset: document.documentElement.style.getPropertyValue('--player-bottom-offset'),
      shell: rect('.shell'),
      player: rect('.sidebar-player'),
      content: rect('.content-scroll'),
      ratio: window.devicePixelRatio,
    };
  }
  // ---- Detached mini window ------------------------------------------------------
  // The main window is never resized for mini mode. A second, always-rendered window
  // shows a live mirror of the player; switching swaps the two windows' visibility, so
  // neither has to redraw. The mirror is a JSON tree of the player and the toast;
  // clicks and keys from the mini window are replayed here.
  const detachedSupported = typeof api.miniSync === 'function';
  let detached = false,
    mirrorObserver = null,
    mirrorQueued = false,
    miniSize = null;
  const mirrorRoots = () => [document.querySelector('.sidebar-player'), $('toast')];
  const mirrorChildren = (node) =>
    [...node.childNodes].filter((n) => n.nodeType === 1 || n.nodeType === 3);
  function serialize(node, { dropStyle = false } = {}) {
    if (node.nodeType === 3) return node.nodeValue;
    const attrs = [];
    for (const { name, value } of node.attributes)
      if (!(dropStyle && name === 'style')) attrs.push([name, value]);
    return {
      t: node.localName,
      ...(node.namespaceURI !== 'http://www.w3.org/1999/xhtml' ? { n: node.namespaceURI } : {}),
      a: attrs,
      c: mirrorChildren(node).map((child) => serialize(child)),
    };
  }
  function mirrorPayload() {
    const [player, toastNode] = mirrorRoots();
    return {
      size: miniSize,
      root: {
        style: document.documentElement.getAttribute('style') || '',
        data: { ...document.documentElement.dataset },
        lang: document.documentElement.lang,
      },
      bodyClass: [...document.body.classList].filter(
        (name) =>
          ![
            'window-transition',
            'player-transition',
            'queue-extended',
            'mini-player',
            'mini-detached',
            'resizing-columns',
            'resizing-panes',
            'album-multi-selection',
          ].includes(name),
      ),
      trees: [
        player ? serialize(player) : null,
        toastNode ? serialize(toastNode, { dropStyle: true }) : null,
      ],
    };
  }
  function sendMirror() {
    mirrorQueued = false;
    if (mirrorObserver) api.miniSync(mirrorPayload());
  }
  function queueMirror() {
    if (mirrorQueued) return;
    mirrorQueued = true;
    // Microtask batching: rAF does not run while the main window is not shown.
    Promise.resolve().then(sendMirror);
  }
  function startMirror() {
    if (mirrorObserver) return;
    mirrorObserver = new window.MutationObserver(queueMirror);
    for (const root of mirrorRoots())
      if (root)
        mirrorObserver.observe(root, {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
    mirrorObserver.observe(document.documentElement, { attributes: true });
    mirrorObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    sendMirror();
  }
  function stopMirror() {
    mirrorObserver?.disconnect();
    mirrorObserver = null;
  }
  function replayMiniInput(input) {
    if (!detached || !input) return;
    if (input.type === 'click') {
      let node = mirrorRoots()[input.root];
      for (const index of input.path || []) node = node && mirrorChildren(node)[index];
      if (node?.nodeType === 1) node.click();
    } else if (input.type === 'key') {
      const target = document.activeElement || document.body;
      target.dispatchEvent(
        new window.KeyboardEvent('keydown', {
          key: input.key,
          code: input.code,
          ctrlKey: input.ctrlKey,
          shiftKey: input.shiftKey,
          altKey: input.altKey,
          metaKey: input.metaKey,
          repeat: input.repeat,
          bubbles: true,
          cancelable: true,
        }),
      );
    }
  }
  if (detachedSupported) api.onMiniInput?.(replayMiniInput);
  async function toggleDetachedMini() {
    miniTransition = true;
    const entering = !detached;
    try {
      if (entering) {
        const sidebar = document.querySelector('.sidebar'),
          player = document.querySelector('.sidebar-player');
        const offset =
          parseFloat(document.documentElement.style.getPropertyValue('--player-bottom-offset')) ||
          0;
        miniSize = {
          width: Math.round(sidebar.getBoundingClientRect().width),
          height: Math.ceil(player.getBoundingClientRect().height + 20 + offset),
        };
        startMirror();
      }
      const viewport = viewportSize();
      const result = await api.windowAction('mini', {
        ...miniSize,
        // Exact client size and scale, for physical-pixel placement of the mini window.
        clientWidth: viewport.width,
        clientHeight: viewport.height,
        scale: window.devicePixelRatio,
        detached: true,
        report: true,
        metrics: geometry(),
      });
      detached = !!motionValue(result);
      document.body.classList.toggle('mini-detached', detached);
      if (!detached) stopMirror();
    } catch (error) {
      toast(error.message);
    } finally {
      miniTransition = false;
    }
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
  function paintFrame({ committed = false } = {}) {
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
      if (fastNativeResize) timer = window.setTimeout(finish, committed ? 64 : 32);
      frame = window.requestAnimationFrame(() => {
        if (fastNativeResize && !committed) finish();
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
    await paintFrame({ committed: document.body.classList.contains('player-transition') });
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
    if (detachedSupported) return toggleDetachedMini();
    miniTransition = true;
    const entering = !document.body.classList.contains('mini-player');
    const panel = $('queue-panel');
    try {
      // The queue is not collapsed first (that was a second native resize plus an
      // animation). Mini mode is entered straight from the current window, and the
      // queue, extended or not, is parked and comes back exactly as it was.
      if (entering)
        heldQueue = panel.hidden
          ? null
          : { extended: document.body.classList.contains('queue-extended') };
      const sidebar = document.querySelector('.sidebar'),
        player = document.querySelector('.sidebar-player'),
        style = document.documentElement.style;
      const size = {
        width: Math.round(sidebar.getBoundingClientRect().width),
        height: Math.ceil(player.getBoundingClientRect().height + 20),
        animate: false,
        report: true,
        metrics: geometry(),
      };
      if (entering) {
        normalLayout = layoutSize();
        style.setProperty('--mini-width', `${size.width}px`);
        // finishLayout() sizes an extended layout as base + queue width; keep a base
        // even if a manual resize released the one recorded when the queue opened.
        if (heldQueue?.extended && !queueBaseLayout)
          queueBaseLayout = {
            width: normalLayout.width - queueWidth,
            height: normalLayout.height,
          };
      }
      const layout = normalLayout || layoutSize();
      freezeLayout(layout.width, layout.height, { player: true });
      document.body.classList.remove('mini-player');
      if (entering && heldQueue) {
        panel.hidden = true;
        document.body.classList.remove('queue-extended');
      }
      // A single rAF runs before paint. Commit the chrome suppression before
      // Windows resizes/crops the existing compositor surface.
      await paintFrame({ committed: true });
      const result = await api.windowAction('mini', size);
      await waitForViewport(result);
      const active = motionValue(result);
      document.body.classList.toggle('mini-player', !!active);
      await finishLayout(() => {
        if (!active) restoreHeldQueue();
      });
    } catch (error) {
      document.body.classList.toggle('mini-player', !entering);
      await finishLayout(() => {
        if (!document.body.classList.contains('mini-player')) restoreHeldQueue();
      });
      toast(error.message);
    } finally {
      miniTransition = false;
    }
  }
  function restoreHeldQueue() {
    const held = heldQueue;
    heldQueue = null;
    if (!held) return;
    const panel = $('queue-panel');
    document.body.classList.toggle('queue-extended', held.extended);
    panel.hidden = false;
    panel.style.clipPath = '';
    alignQueueClose();
    revealPlayingQueueItem();
  }

  function queueRowVisible(list, row) {
    if (!row || !list.clientHeight) return false;
    const box = list.getBoundingClientRect(),
      rect = row.getBoundingClientRect();
    return rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1;
  }

  // Pins the playing row to the top of the queue. With onlyIfHidden the list is left
  // alone while that row is still fully in view, so the queue does not jump on every
  // track change.
  function revealPlayingQueueItem({ onlyIfHidden = false } = {}) {
    const list = $('queue-list'),
      row = list.querySelector('.active');
    list.style.paddingBottom = '12px';
    if (!row) {
      if (!onlyIfHidden) list.scrollTop = 0;
      return;
    }
    if (onlyIfHidden && queueRowVisible(list, row)) return;
    list.scrollTop += row.getBoundingClientRect().top - list.getBoundingClientRect().top;
  }

  let queueWindowJobs = Promise.resolve();
  let queueRequested = false;
  function setQueueVisible(show, { animate = true } = {}) {
    // The queue is parked while mini; it returns when mini mode is left.
    if (document.body.classList.contains('mini-player') || detached || miniTransition)
      return Promise.resolve();
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
          if (animate && extend && !wasDocked && queueRevealEnabled())
            $('queue-panel').style.clipPath = 'inset(0 100% 0 0)';
          alignQueueClose();
          await paintFrame();
          let commit = () => {
            document.body.classList.toggle('queue-extended', wasDocked);
            $('queue-panel').hidden = !wasDocked;
          };
          try {
            if (animate && !extend && wasDocked) await animateQueue(false);
            const result = await api.windowAction?.(extend ? 'queue-open' : 'queue-close', {
              animate: animate && motionEnabled(),
              report: true,
              metrics: geometry(),
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
            if (animate && docked && !wasDocked) await animateQueue(true);
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
    queueRowVisible,
    get transitioning() {
      return windowTransition;
    },
    get queueHeld() {
      return !!heldQueue;
    },
    get mini() {
      return detached || document.body.classList.contains('mini-player');
    },
    dispose() {
      stopMirror();
      window.removeEventListener('resize', onResize);
      playerObserver?.disconnect();
    },
  };
}
