#!/usr/bin/env node
/**
 * Hook PostToolUse de Claude Code (Edit / Write / MultiEdit).
 * Tras cada edición de un archivo de código: ESLint sobre ese archivo + typecheck de su paquete.
 * La suite completa de tests la corre el subagente `tester` (correrla en cada edición sería demasiado lento).
 *
 * Salida: código 0 = OK (silencioso). Código 2 = hay errores; stderr se le devuelve a Claude para que los corrija.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CODE_EXT = /\.(ts|tsx|mts|js|mjs|jsx)$/;
const PACKAGES = ['shared', 'backend', 'frontend'];

let input = '';
try {
  input = fs.readFileSync(0, 'utf8');
} catch {
  process.exit(0);
}

let filePath;
try {
  filePath = JSON.parse(input)?.tool_input?.file_path;
} catch {
  process.exit(0);
}
if (!filePath || !CODE_EXT.test(filePath)) process.exit(0);

const abs = path.resolve(filePath);
const relPath = path.relative(root, abs);
if (relPath.startsWith('..') || /(^|[\\/])(node_modules|dist|\.claude|_bmad)([\\/]|$)/.test(relPath)) process.exit(0);
if (!fs.existsSync(abs)) process.exit(0);

const run = (args) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
const problems = [];

const eslint = run([path.join(root, 'node_modules', 'eslint', 'bin', 'eslint.js'), '--no-warn-ignored', abs]);
if (eslint.status !== 0) problems.push(`ESLint (${relPath}):\n${(eslint.stdout || eslint.stderr).trim()}`);

const pkg = PACKAGES.find((p) => relPath.split(/[\\/]/)[0] === p);
if (pkg) {
  const tsc = run([path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', pkg, '--noEmit']);
  if (tsc.status !== 0) problems.push(`TypeScript (${pkg}):\n${(tsc.stdout || tsc.stderr).trim()}`);
}

if (problems.length) {
  process.stderr.write(`Hook post-edit: corrige estos problemas antes de continuar.\n\n${problems.join('\n\n')}\n`);
  process.exit(2);
}
process.exit(0);
