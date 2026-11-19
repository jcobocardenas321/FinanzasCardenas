// [A.4][B.5] SPIKE 2: ¿SweetAlert2 y el backend nativo funcionan bajo la CSP estricta?
const violations = [];
document.addEventListener('securitypolicyviolation', (e) => {
  violations.push({ directive: e.violatedDirective, blocked: e.blockedURI, sample: e.sample });
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, timeout = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = fn();
    if (v) return v;
    await wait(25);
  }
  return null;
}

async function exercise(label, backendPath, sel) {
  const checks = [];
  const add = (name, ok, detail = null) => checks.push({ name, ok: Boolean(ok), detail });
  let backend;
  try {
    backend = await import(backendPath);
  } catch (error) {
    add('import del backend', false, String(error));
    return { label, checks };
  }
  add('import del backend', true, backend.name);

  const pending = backend.confirm({ title: 'Eliminar movimiento', text: 'Esta acción no se puede deshacer.', confirmText: 'Eliminar', cancelText: 'Cancelar', danger: true });
  const root = await until(() => document.querySelector(sel.root));
  add('el diálogo aparece en el DOM', root);
  if (root) {
    const style = getComputedStyle(root);
    const rect = root.getBoundingClientRect();
    add('es visible y tiene tamaño (CSS aplicado)', style.display !== 'none' && rect.width > 100 && rect.height > 50, `${style.display} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
    const confirmBtn = root.querySelector(sel.confirm);
    add('botón de confirmar presente', confirmBtn);
    confirmBtn?.click();
  }
  add('confirm() resuelve true al confirmar', (await pending) === true);
  await until(() => !document.querySelector(sel.root), 3000);

  const pending2 = backend.confirm({ title: 'Cancelar prueba', text: 'Prueba de Escape', danger: true });
  await until(() => document.querySelector(sel.root));
  await wait(150);
  const cancelBtn = document.querySelector(`${sel.root} ${sel.cancel}`);
  cancelBtn?.click();
  add('confirm() resuelve false al cancelar', (await pending2) === false);
  await until(() => !document.querySelector(sel.root), 3000);

  const pending3 = backend.notice({ title: 'Listo', text: 'Mensaje informativo', type: 'info' });
  const root3 = await until(() => document.querySelector(sel.root));
  add('notice() aparece', root3);
  (root3?.querySelector(sel.confirm) ?? root3?.querySelector(sel.ok))?.click();
  await pending3;
  add('notice() resuelve', true);
  return { label, checks };
}

const report = { csp: null, fontawesome: null, backends: [], violations, done: false };
try {
  report.csp = (await fetch(location.href, { method: 'HEAD' })).headers.get('content-security-policy');
  await document.fonts.load('900 16px "Font Awesome 7 Free"');
  report.fontawesome = document.fonts.check('900 16px "Font Awesome 7 Free"');

  report.backends.push(
    await exercise('sweetalert2', '../js/ui/dialogs.swal.js', { root: '.swal2-popup', confirm: '.swal2-confirm', cancel: '.swal2-cancel', ok: '.swal2-confirm' }),
  );
  report.backends.push(
    await exercise('native-dialog', '../js/ui/dialogs.native.js', { root: 'dialog.fc-dialog[open]', confirm: 'button[value="confirm"]', cancel: 'button[value="cancel"]', ok: 'button[value="ok"]' }),
  );
} catch (error) {
  report.error = String(error?.stack ?? error);
}
report.done = true;
window.__report = report;
