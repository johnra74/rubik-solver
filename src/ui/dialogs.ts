/** Accessible confirm dialog and the "update ready" banner. */
import { h } from './dom';

export function confirmDialog(opts: { title: string; message: string; confirmLabel: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const prev = document.activeElement as HTMLElement | null;
    const cancel = h('button', { type: 'button', class: 'btn' }, 'Cancel');
    const ok = h('button', { type: 'button', class: 'btn btn-primary', 'data-testid': 'confirm-ok' }, opts.confirmLabel);
    const dlg = h(
      'dialog',
      { class: 'dialog', 'aria-labelledby': 'dlg-title', 'aria-describedby': 'dlg-msg' },
      h('h2', { id: 'dlg-title' }, opts.title),
      h('p', { id: 'dlg-msg' }, opts.message),
      h('div', { class: 'dialog-actions' }, cancel, ok),
    );
    const done = (v: boolean) => {
      dlg.close();
      dlg.remove();
      prev?.focus();
      resolve(v);
    };
    cancel.addEventListener('click', () => done(false));
    ok.addEventListener('click', () => done(true));
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      done(false);
    });
    document.body.append(dlg);
    dlg.showModal(); // native modal: focus is trapped inside the dialog, Esc cancels
    ok.focus();
  });
}

export function isDialogOpen(): boolean {
  return !!document.querySelector('dialog[open]');
}

export function updateBanner(onReload: () => void): HTMLElement {
  const banner = h(
    'div',
    { class: 'update-banner', role: 'status' },
    h('span', {}, 'Update ready — reload to apply.'),
    h('button', { type: 'button', class: 'btn btn-primary', onclick: onReload }, 'Reload'),
    h('button', { type: 'button', class: 'btn', 'aria-label': 'Dismiss', onclick: () => banner.remove() }, '×'),
  );
  document.body.append(banner);
  return banner;
}
