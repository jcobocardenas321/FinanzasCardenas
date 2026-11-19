// [A.1][A.3] Tabla de rutas. `public`: sin sesión · `roles`: restringe por rol · `nav`: aparece en el sidebar ·
// `tabs`: pestañas internas del módulo (#/modulo/pestaña) · `layout`: 'app' (por defecto) o 'auth'.
const auth = (name) => () => import(`/js/modules/auth/${name}-view.js`);
const mod = (path) => () => import(path);

export const ROUTES = [
  { path: 'login', public: true, layout: 'auth', title: 'Iniciar sesión', view: auth('login') },
  { path: 'setup', public: true, layout: 'auth', title: 'Configuración inicial', view: auth('setup') },
  { path: 'recover', public: true, layout: 'auth', title: 'Recuperar acceso', view: auth('recover') },
  { path: 'change-password', layout: 'auth', title: 'Cambiar contraseña', view: auth('change-password') },

  { path: 'dashboard', title: 'Panel de control', nav: { icon: 'gauge-high', label: 'Panel' }, view: mod('/js/modules/dashboard/dashboard-view.js') },
  { path: 'transactions', title: 'Transacciones', nav: { icon: 'right-left', label: 'Transacciones' }, view: mod('/js/modules/transactions/transactions-view.js'),
    tabs: [{ id: 'all', label: 'Todos' }, { id: 'income', label: 'Ingresos' }, { id: 'expense', label: 'Gastos' }] },
  { path: 'budgets', title: 'Presupuestos', nav: { icon: 'scale-balanced', label: 'Presupuestos' }, view: mod('/js/modules/budgets/budgets-view.js') },
  { path: 'goals', title: 'Metas de ahorro', nav: { icon: 'bullseye', label: 'Metas' }, view: mod('/js/modules/goals/goals-view.js') },
  { path: 'reports', title: 'Reportes', nav: { icon: 'file-lines', label: 'Reportes' }, view: mod('/js/modules/reports/reports-view.js'),
    tabs: [{ id: 'summary', label: 'Resumen' }, { id: 'detail', label: 'Detalle' }] },
  { path: 'categories', title: 'Categorías', nav: { icon: 'tags', label: 'Categorías' }, view: mod('/js/modules/categories/categories-view.js') },
  { path: 'users', title: 'Usuarios', roles: ['admin'], nav: { icon: 'users', label: 'Usuarios' }, view: mod('/js/modules/users/users-view.js') },
  { path: 'settings', title: 'Configuración', nav: { icon: 'gear', label: 'Configuración' }, view: mod('/js/modules/settings/settings-view.js') },
  { path: 'not-found', title: 'Página no encontrada', view: () => import('/js/modules/shared/not-found-view.js') },
];
