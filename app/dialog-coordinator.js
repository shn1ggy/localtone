// Own modal lifetimes and focus restoration without owning collection edits.
export function createDialogCoordinator({
  document,
  captureFocus,
  restoreFocus,
  canDismiss,
  onClose,
}) {
  const returns = new Map(),
    cleanups = [];
  for (const dialog of document.querySelectorAll('dialog')) {
    let outsideDown = false;
    const outside = (event) => {
      const r = dialog.getBoundingClientRect();
      return (
        event.target === dialog &&
        (event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom)
      );
    };
    const down = (event) => {
      outsideDown = outside(event);
    };
    const click = (event) => {
      if (outsideDown && outside(event) && canDismiss()) dialog.close();
      outsideDown = false;
    };
    const close = () => {
      const previous = returns.get(dialog);
      returns.delete(dialog);
      outsideDown = false;
      onClose?.(dialog);
      if (previous) restoreFocus(previous);
    };
    dialog.addEventListener('pointerdown', down);
    dialog.addEventListener('click', click);
    dialog.addEventListener('close', close);
    cleanups.push(() => {
      dialog.removeEventListener('pointerdown', down);
      dialog.removeEventListener('click', click);
      dialog.removeEventListener('close', close);
    });
  }
  return {
    open(dialog) {
      if (dialog.open) return;
      const previous = captureFocus();
      returns.set(dialog, previous);
      try {
        dialog.showModal();
      } catch (error) {
        returns.delete(dialog);
        throw error;
      }
    },
    dispose() {
      cleanups.forEach((cleanup) => cleanup());
      returns.clear();
    },
  };
}
