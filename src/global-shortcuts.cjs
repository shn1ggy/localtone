const bindings = [
  ['CommandOrControl+Left', 'previous'],
  ['CommandOrControl+Right', 'next'],
  ['CommandOrControl+Shift+Right', 'random'],
];
class PlaybackShortcuts {
  constructor(api, send) {
    this.api = api;
    this.send = send;
    this.active = false;
    this.error = '';
  }
  set(enabled, custom) {
    const next = custom
      ? ['previous', 'next', 'random'].map((action) => [
          custom[action]
            .replace('Mod+', 'CommandOrControl+')
            .replace('Arrow', '')
            .replace('Space', 'Space'),
          action,
        ])
      : bindings;
    const signature = JSON.stringify(next);
    if (enabled && this.active && this.signature === signature) return;
    if (this.active) {
      for (const [key] of this.bindings || bindings) this.api?.unregister(key);
      this.active = false;
    }
    this.bindings = next;
    this.signature = signature;
    if (!enabled) {
      for (const [key] of this.bindings) this.api?.unregister(key);
      this.active = false;
      this.error = '';
      return;
    }
    const registered = [];
    try {
      for (const [key, action] of this.bindings) {
        if (!this.api?.register(key, () => this.send(action)))
          throw new Error(
            `Cannot register ${key}. It may be used by another app or reserved by the OS.`,
          );
        registered.push(key);
      }
      this.active = true;
      this.error = '';
    } catch (error) {
      for (const key of registered) this.api?.unregister(key);
      this.error = error.message;
      throw error;
    }
  }
  status() {
    return { active: this.active, error: this.error };
  }
}
module.exports = { PlaybackShortcuts };
