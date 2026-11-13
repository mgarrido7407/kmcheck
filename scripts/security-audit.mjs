#!/usr/bin/env node
/**
 * Auditoría de seguridad del frontend: verifica que el navegador nunca toque la IA ni los secretos.
 * Uso: node scripts/security-audit.mjs        (sale con código 1 si encuentra problemas)
 * La usan la skill /security-audit, el pipeline de CI y cualquier desarrollador antes de un commit.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const findings = [];
const add = (severity, where, msg) => findings.push({ severity, where, msg });

function walk(dir, exts) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p, exts);
    return exts.some((x) => e.name.endsWith(x)) ? [p] : [];
  });
}
const rel = (p) => path.relative(root, p).replaceAll('\\', '/');

// 1) Código fuente del frontend
const SOURCE_RULES = [
  [/from\s+['"](@anthropic-ai\/[^'"]+|openai|dotenv)['"]/, 'Importa un SDK de IA o dotenv en el frontend'],
  [/api\.anthropic\.com/, 'URL directa a la API de Anthropic en el frontend'],
  [/\bprocess\.env\b/, 'Uso de process.env en el frontend'],
  [/import\.meta\.env\.VITE_\w*(KEY|SECRET|TOKEN|PASSWORD)\w*/i, 'Variable VITE_ con nombre de secreto (se incrustaría en el bundle)'],
  [/sk-ant-[A-Za-z0-9_-]{8,}/, 'Posible API key de Anthropic escrita en el código'],
  [/fetch\(\s*['"`]https?:\/\//, 'fetch a una URL absoluta: el frontend solo debe llamar a /api del mismo origen'],
];
for (const file of walk(path.join(root, 'frontend', 'src'), ['.ts', '.tsx', '.js', '.jsx'])) {
  if (/\.test\.[jt]sx?$/.test(file)) continue;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const [re, msg] of SOURCE_RULES) if (re.test(line)) add('ALTO', `${rel(file)}:${i + 1}`, msg);
  });
}

// 2) Bundle de producción (si existe)
const dist = path.join(root, 'frontend', 'dist');
const BUNDLE_RULES = [
  [/sk-ant-[A-Za-z0-9_-]{8,}/, 'API key de Anthropic dentro del bundle'],
  [/ANTHROPIC_API_KEY/, 'Nombre de variable ANTHROPIC_API_KEY dentro del bundle'],
  [/api\.anthropic\.com/, 'URL de la API de Anthropic dentro del bundle'],
  [/localhost:5000/, 'URL del backend local incrustada en el bundle'],
];
const bundleFiles = walk(dist, ['.js', '.html', '.css', '.map']);
for (const file of bundleFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const [re, msg] of BUNDLE_RULES) if (re.test(text)) add('CRÍTICO', rel(file), msg);
}

// 3) Archivos .env
const gitignore = fs.existsSync(path.join(root, '.gitignore')) ? fs.readFileSync(path.join(root, '.gitignore'), 'utf8') : '';
if (!/^\.env$/m.test(gitignore)) add('ALTO', '.gitignore', 'No ignora los archivos .env');
for (const file of walk(path.join(root, 'frontend'), ['.env', '.env.local', '.env.production', '.env.development'])) {
  const text = fs.readFileSync(file, 'utf8');
  if (/^VITE_\w*(KEY|SECRET|TOKEN|PASSWORD)\w*\s*=/im.test(text)) add('CRÍTICO', rel(file), 'Secreto con prefijo VITE_ (se expone al navegador)');
}
try {
  const tracked = execSync('git ls-files', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    .split('\n')
    .filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith('.env.example'));
  for (const f of tracked) add('CRÍTICO', f, 'Archivo .env versionado en git');
} catch {
  // Sin repositorio git o sin commits: se omite esta comprobación.
}

// 4) Configuración del Worker: la API key nunca debe ir en "vars"
const wranglerPath = path.join(root, 'wrangler.jsonc');
if (fs.existsSync(wranglerPath) && /"ANTHROPIC_API_KEY"\s*:/.test(fs.readFileSync(wranglerPath, 'utf8'))) {
  add('CRÍTICO', 'wrangler.jsonc', 'ANTHROPIC_API_KEY en "vars": usa `wrangler secret put` en su lugar');
}

// Reporte
console.log('Auditoría de seguridad — KmCheck');
console.log(`  Archivos del frontend revisados: ${walk(path.join(root, 'frontend', 'src'), ['.ts', '.tsx']).length}`);
console.log(`  Bundle de producción: ${bundleFiles.length ? `${bundleFiles.length} archivos revisados` : 'no encontrado (ejecuta npm run build para incluirlo)'}`);
if (findings.length === 0) {
  console.log('\n✔ Sin hallazgos: el frontend no accede a la IA ni expone secretos.');
  process.exit(0);
}
console.log(`\n✖ ${findings.length} hallazgo(s):`);
for (const f of findings) console.log(`  [${f.severity}] ${f.where} — ${f.msg}`);
process.exit(1);
