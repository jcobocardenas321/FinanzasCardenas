// [B.5][D.15] Copia SweetAlert2 y FontAwesome Free a src/renderer/vendor (uso 100 % local, sin CDN).
// Se ejecuta en postinstall. Si las devDependencies no están (instalación de producción), se omite.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nm = (...p) => path.join(root, 'node_modules', ...p);
const out = (...p) => path.join(root, 'src', 'renderer', 'vendor', ...p);

const FILES = [
  // SweetAlert2: build ESM SIN estilos incrustados (la variante *.all inyecta <style> y choca con la CSP).
  [nm('sweetalert2', 'dist', 'sweetalert2.esm.js'), out('sweetalert2', 'sweetalert2.esm.js')],
  [nm('sweetalert2', 'dist', 'sweetalert2.min.css'), out('sweetalert2', 'sweetalert2.min.css')],
  [nm('sweetalert2', 'LICENSE'), out('sweetalert2', 'LICENSE')],
  [nm('@fortawesome', 'fontawesome-free', 'css', 'fontawesome.min.css'), out('fontawesome', 'css', 'fontawesome.min.css')],
  [nm('@fortawesome', 'fontawesome-free', 'css', 'solid.min.css'), out('fontawesome', 'css', 'solid.min.css')],
  [nm('@fortawesome', 'fontawesome-free', 'webfonts', 'fa-solid-900.woff2'), out('fontawesome', 'webfonts', 'fa-solid-900.woff2')],
  [nm('@fortawesome', 'fontawesome-free', 'LICENSE.txt'), out('fontawesome', 'LICENSE.txt')],
  // Liquid Glass Fonts: Inter, Outfit, JetBrains Mono
  [nm('@fontsource', 'inter', 'files', 'inter-latin-400-normal.woff2'), out('fonts', 'inter', '400.woff2')],
  [nm('@fontsource', 'inter', 'files', 'inter-latin-700-normal.woff2'), out('fonts', 'inter', '700.woff2')],
  [nm('@fontsource', 'outfit', 'files', 'outfit-latin-400-normal.woff2'), out('fonts', 'outfit', '400.woff2')],
  [nm('@fontsource', 'outfit', 'files', 'outfit-latin-600-normal.woff2'), out('fonts', 'outfit', '600.woff2')],
  [nm('@fontsource', 'outfit', 'files', 'outfit-latin-800-normal.woff2'), out('fonts', 'outfit', '800.woff2')],
  [nm('@fontsource', 'jetbrains-mono', 'files', 'jetbrains-mono-latin-400-normal.woff2'), out('fonts', 'jetbrains-mono', '400.woff2')],
  [nm('@fontsource', 'jetbrains-mono', 'files', 'jetbrains-mono-latin-500-normal.woff2'), out('fonts', 'jetbrains-mono', '500.woff2')],
  [nm('@fontsource', 'jetbrains-mono', 'files', 'jetbrains-mono-latin-700-normal.woff2'), out('fonts', 'jetbrains-mono', '700.woff2')],
];

let copied = 0;
for (const [from, to] of FILES) {
  if (!fs.existsSync(from)) {
    console.warn(`[vendor] omitido (no existe): ${path.relative(root, from)}`);
    continue;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  copied += 1;
}
console.log(`[vendor] ${copied}/${FILES.length} archivos copiados a src/renderer/vendor`);
