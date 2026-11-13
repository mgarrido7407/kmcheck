import { z } from 'zod';

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5';

const BooleanFlagSchema = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const normalized = v.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  return v;
}, z.boolean());

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  TRUST_PROXY: BooleanFlagSchema.default(false),
  AI_PROVIDER: z.enum(['rules', 'claude']).default('rules'),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().min(1).default(DEFAULT_CLAUDE_MODEL),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  AI_CACHE_TTL_MS: z.coerce.number().int().min(0).default(300000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
});

export type AppConfig = z.infer<typeof EnvSchema>;

/**
 * Lee la configuración desde un objeto de variables (process.env en Node, `env` en Cloudflare Workers).
 * Los strings vacíos se tratan como "no definido".
 */
export function loadConfig(env: Record<string, unknown>): AppConfig {
  const clean = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== '' && v !== undefined));
  return EnvSchema.parse(clean);
}
