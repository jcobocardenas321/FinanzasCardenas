-- [A.1][A.4] Categorías iniciales (editables). Evitan un catálogo vacío en el primer arranque.
INSERT INTO categories (name, kind, color, icon) VALUES
  ('Salario',         'income',  '#16A34A', 'fa-briefcase'),
  ('Otros ingresos',  'income',  '#0D9488', 'fa-plus'),
  ('Vivienda',        'expense', '#7C3AED', 'fa-house'),
  ('Alimentación',    'expense', '#EA580C', 'fa-utensils'),
  ('Transporte',      'expense', '#2563EB', 'fa-bus'),
  ('Servicios',       'expense', '#CA8A04', 'fa-bolt'),
  ('Salud',           'expense', '#DC2626', 'fa-heart-pulse'),
  ('Educación',       'expense', '#4F46E5', 'fa-graduation-cap'),
  ('Otros gastos',    'expense', '#64748B', 'fa-ellipsis');
