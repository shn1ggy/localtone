// Explicit submission avoids the first (Cancel) button acting as the
// default submitter when Return is pressed in the name field.
export function createNameDialog(document, open = (dialog) => dialog.showModal()) {
  const dialog = document.getElementById('name-dialog');
  const form = document.getElementById('name-form');
  const input = document.getElementById('name-input');
  const save = document.getElementById('name-save');
  let pending = null;
  function finish(value) {
    if (!pending) return;
    const resolve = pending;
    pending = null;
    dialog.close();
    resolve(value);
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim();
    input.setCustomValidity(value ? '' : 'Enter a name.');
    if (!form.reportValidity()) return;
    finish(value);
  });
  input.addEventListener('input', () => input.setCustomValidity(''));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit(save);
    }
  });
  document.getElementById('name-close')?.addEventListener('click', () => finish(null));
  document.getElementById('name-cancel').addEventListener('click', () => finish(null));
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    finish(null);
  });
  dialog.addEventListener('close', () => {
    if (pending) {
      const resolve = pending;
      pending = null;
      resolve(null);
    }
  });
  return (title, initial = '', submitLabel = 'Add') => {
    if (pending) return Promise.resolve(null);
    document.getElementById('dialog-title').textContent = title;
    input.value = initial;
    input.setCustomValidity('');
    save.textContent = submitLabel;
    return new Promise((resolve) => {
      pending = resolve;
      open(dialog);
      input.focus();
      input.select();
    });
  };
}
