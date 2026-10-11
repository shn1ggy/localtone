// Shared SVG definitions and construction; no application state.
const iconPaths = {
  play: 'M8 5l11 7-11 7Z',
  pause: 'M6 5h4v14H6ZM14 5h4v14h-4Z',
  previous: 'M4 5h2v14H4ZM19 5 8 12l11 7Z',
  next: 'M18 5h2v14h-2ZM5 5l11 7-11 7Z',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M18 6 6 18',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15M16 16l5 5',
  up: 'm6 10 6-6 6 6M12 4v16',
  down: 'm6 14 6 6 6-6M12 4v16',
  back: 'm10 5-7 7 7 7M3 12h18',
  folder: 'M3 6h7l2 3h9v11H3ZM3 6V4h7l2 2',
  playlist: 'M4 5h16M4 10h16M4 15h9M4 20h9M18 14v7m-3-3h6',
  dynamic: 'M4 5h10M4 10h8M4 15h5M4 20h5M20 12a5 5 0 1 0 1 7M20 8v4h-4',
  grid: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
  queue: 'M3 5h18M3 10h18M3 15h10M16 14l5 4-5 4Z',
  shuffle: 'M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3m-4-4 4 4-4 4',
  repeat: 'm17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3',
  repeatOne:
    'm17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3M10 10l2-1v6',
  settings:
    'M18.93 9.13L21.32 10.15L21.32 13.85L18.93 14.87L18.93 14.87L19.90 17.28L17.28 19.90L14.87 18.93L14.87 18.93L13.85 21.32L10.15 21.32L9.13 18.93L9.13 18.93L6.72 19.90L4.10 17.28L5.07 14.87L5.07 14.87L2.68 13.85L2.68 10.15L5.07 9.13L5.07 9.13L4.10 6.72L6.72 4.10L9.13 5.07L9.13 5.07L10.15 2.68L13.85 2.68L14.87 5.07L14.87 5.07L17.28 4.10L19.90 6.72L18.93 9.13ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  music: 'M9 18V5l11-2v13M9 8l11-2M9 18a3 3 0 1 1-3-3h3M20 16a3 3 0 1 1-3-3h3',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',
  check: 'm4 12 5 5L20 6',
};

export function createIcons(document) {
  const markers = new Set();
  let markerShape = null;
  function icon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'ui-icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.dataset.icon = name;
    if (name === 'pulse' || name === 'playback') {
      svg.setAttribute('viewBox', '0 0 24 27');
      for (const [x, y, height] of [
        [0.6, 2, 22],
        [6.8, 9.5, 11.8],
        [12.9, 15.1, 11.2],
        [18.8, 10.5, 11.5],
      ]) {
        const bar = document.createElementNS(svg.namespaceURI, 'rect');
        for (const [key, value] of Object.entries({ x, y, width: 4.8, height, rx: 2.4 }))
          bar.setAttribute(key, String(value));
        svg.append(bar);
      }
      if (name === 'playback') {
        svg.classList.add('playback-marker');
        if (markerShape)
          [...svg.children].forEach((bar, i) => {
            bar.setAttribute('y', markerShape[i].y);
            bar.setAttribute('height', markerShape[i].height);
          });
        for (const old of markers) if (!old.isConnected) markers.delete(old);
        markers.add(svg);
      }
      return svg;
    }
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', iconPaths[name] || iconPaths.music);
    svg.append(path);
    return svg;
  }
  function setIcon(node, name) {
    node.replaceChildren(icon(name));
  }
  return {
    icon,
    setIcon,
    animatePulse: (svg, audio) =>
      animatePulse(svg, audio, document, markers, (shape) => {
        markerShape = shape;
      }),
  };
}

// Height/y changes preserve the exact circular caps; transforms would stretch them.
function animatePulse(svg, audio, document, markers, rememberShape) {
  const window = document.defaultView;
  const bars = [...svg.querySelectorAll('rect')];
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const phases = [0, Math.PI * 0.65, Math.PI * 1.35, Math.PI];
  let enabled = true;
  const original = bars.map((bar) => ({
    y: bar.getAttribute('y'),
    height: bar.getAttribute('height'),
  }));
  let active = false,
    frameId = null,
    elapsed = 0,
    markerElapsed = 0,
    previous = null,
    disposed = false;
  const bindings = [];
  function cancel() {
    if (frameId !== null) window.cancelAnimationFrame(frameId);
    frameId = null;
    previous = null;
  }
  function frame(now) {
    frameId = null;
    if (!active || disposed || document.hidden || motion?.matches) return;
    const delta = previous === null ? 0 : Math.min((now - previous) / 1000, 0.05);
    if (enabled) elapsed += delta;
    markerElapsed = enabled ? elapsed : markerElapsed + delta;
    previous = now;
    const geometry = (time) => {
      const t = (time * Math.PI * 2) / 2.5;
      return bars.map((bar, i) => {
        const height = (i === 0 || i === 3 ? 16.5 : 14) + 5.5 * Math.cos(t + phases[i]);
        const center = 13.5 + 1.1 * Math.sin(t + phases[i]);
        const progress = Math.min(1, time / 0.4),
          blend = progress * progress * (3 - 2 * progress);
        return {
          height: (
            Number(original[i].height) +
            (height - Number(original[i].height)) * blend
          ).toFixed(3),
          y: (
            Number(original[i].y) +
            (center - height / 2 - Number(original[i].y)) * blend
          ).toFixed(3),
        };
      });
    };
    const shape = geometry(markerElapsed);
    rememberShape(shape);
    const paint = (nodes, values) =>
      nodes.forEach((bar, i) => {
        bar.setAttribute('height', values[i].height);
        bar.setAttribute('y', values[i].y);
      });
    if (enabled) paint(bars, shape);
    for (const marker of markers) {
      if (!marker.isConnected) markers.delete(marker);
      else paint([...marker.children], shape);
    }
    schedule();
  }
  function schedule() {
    if (
      (enabled || markers.size > 0) &&
      active &&
      !disposed &&
      !document.hidden &&
      !motion?.matches &&
      frameId === null &&
      window.requestAnimationFrame
    )
      frameId = window.requestAnimationFrame(frame);
  }
  function start() {
    active = true;
    svg.dataset.playbackMotion = 'playing';
    schedule();
  }
  function stop() {
    active = false;
    svg.dataset.playbackMotion = 'paused';
    cancel();
  }
  function visibility() {
    cancel();
    schedule();
  }
  function bind(target, event, handler) {
    target.addEventListener(event, handler);
    bindings.push(() => target.removeEventListener(event, handler));
  }
  bind(audio, 'playing', start);
  for (const event of ['pause', 'ended', 'waiting', 'seeking', 'emptied', 'error'])
    bind(audio, event, stop);
  bind(audio, 'seeked', () => {
    if (!audio.paused) start();
  });
  bind(document, 'visibilitychange', visibility);
  if (motion?.addEventListener) bind(motion, 'change', visibility);
  stop();
  return {
    setEnabled(value) {
      enabled = value;
      cancel();
      schedule();
    },
    dispose() {
      disposed = true;
      cancel();
      bindings.forEach((remove) => remove());
    },
  };
}
