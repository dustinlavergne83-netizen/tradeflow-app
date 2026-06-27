/**
 * Global notification helpers — replaces all browser alert/confirm/prompt dialogs.
 *
 * Usage:
 *   import { notify, confirmDialog, promptDialog } from '../lib/notify';
 *
 *   notify('Saved!');                          // success toast (auto-detected)
 *   notify('Something went wrong', 'error');   // explicit type
 *   const ok = await confirmDialog('Delete?'); // styled confirm → true/false
 *   const val = await promptDialog('Name:');   // styled prompt → string|null
 */

const listeners = new Set();

export function _subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function _emit(event) {
  listeners.forEach(fn => fn(event));
}

/** Show a toast notification. Type auto-detected from emoji/keyword if omitted. */
export function notify(message, type) {
  const msg = String(message ?? '');
  let t = type;
  if (!t) {
    if (/✅|success|saved|sent|applied|created|updated|deleted|approved/i.test(msg)) t = 'success';
    else if (/❌|fail|error|invalid|required|not found|cannot/i.test(msg))            t = 'error';
    else if (/⚠️|warning|warn/i.test(msg))                                            t = 'warning';
    else                                                                              t = 'info';
  }
  _emit({ kind: 'toast', message: msg, type: t });
}

/** Styled replacement for window.confirm(). Returns Promise<boolean>. */
export function confirmDialog(message) {
  return new Promise(resolve => {
    _emit({ kind: 'confirm', message: String(message ?? ''), resolve });
  });
}

/** Styled replacement for window.prompt(). Returns Promise<string|null>. */
export function promptDialog(message, defaultValue = '') {
  return new Promise(resolve => {
    _emit({ kind: 'prompt', message: String(message ?? ''), defaultValue: String(defaultValue ?? ''), resolve });
  });
}
