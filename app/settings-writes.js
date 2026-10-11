// Optimistic settings changes share the application's serialized write lane.
// Per-key revisions prevent a failed old write reverting a newer user choice.
export function createSettingsWrites({
  getPreferences,
  setPreferences,
  isBusy,
  apply,
  write,
  clearError,
  showError,
}) {
  const revisions = new Map(),
    confirmed = new Map(),
    pending = new Map();
  return {
    async update(patch) {
      if (isBusy()) {
        showError('Wait for the current operation.');
        apply();
        return;
      }
      const before = { ...getPreferences() },
        versions = new Map();
      for (const key of Object.keys(patch)) {
        if (!pending.get(key)) confirmed.set(key, before[key]);
        pending.set(key, (pending.get(key) || 0) + 1);
        const version = (revisions.get(key) || 0) + 1;
        revisions.set(key, version);
        versions.set(key, version);
      }
      setPreferences({ ...before, ...patch });
      apply();
      clearError();
      try {
        await write(patch);
        for (const key of Object.keys(patch)) confirmed.set(key, patch[key]);
      } catch (error) {
        const next = { ...getPreferences() };
        for (const key of Object.keys(patch)) {
          if (revisions.get(key) === versions.get(key) && next[key] === patch[key])
            next[key] = confirmed.get(key);
        }
        setPreferences(next);
        apply();
        showError(error.message);
      } finally {
        for (const key of Object.keys(patch)) pending.set(key, pending.get(key) - 1);
      }
    },
  };
}
