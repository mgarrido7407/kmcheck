/**
 * Logger mínimo que nunca imprime secretos.
 * Cualquier valor que parezca una API key se redacta antes de escribir.
 * Funciona en Node y en Cloudflare Workers.
 */
const SECRET_PATTERNS = [/sk-ant-[A-Za-z0-9_-]+/g, /(api[_-]?key["'\s:=]+)[^\s"',}]+/gi];

const env = (): Record<string, string | undefined> =>
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

let extraSecrets: string[] = [];

/** Registra valores secretos adicionales a redactar (p. ej. la API key leída del entorno del Worker). */
export function registerSecret(value: string | undefined) {
  if (value && value.length > 8 && !extraSecrets.includes(value)) extraSecrets = [...extraSecrets, value];
}

export function redact(input: string): string {
  let out = input;
  for (const p of SECRET_PATTERNS) {
    out = out.replace(p, (_m, prefix?: string) => (typeof prefix === 'string' ? `${prefix}[REDACTED]` : '[REDACTED]'));
  }
  const secrets = [env().ANTHROPIC_API_KEY, ...extraSecrets];
  for (const s of secrets) if (s && s.length > 8) out = out.split(s).join('[REDACTED]');
  return out;
}

function fmt(level: string, msg: string, meta?: unknown): string {
  const base = `${new Date().toISOString()} [${level}] ${msg}`;
  if (meta === undefined) return redact(base);
  const metaStr = meta instanceof Error ? `${meta.name}: ${meta.message}` : JSON.stringify(meta);
  return redact(`${base} ${metaStr}`);
}

export const logger = {
  info: (msg: string, meta?: unknown) => {
    if (env().NODE_ENV !== 'test') console.log(fmt('INFO', msg, meta));
  },
  warn: (msg: string, meta?: unknown) => console.warn(fmt('WARN', msg, meta)),
  error: (msg: string, meta?: unknown) => console.error(fmt('ERROR', msg, meta)),
};
