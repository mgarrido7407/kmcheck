/**
 * Entrada para Cloudflare Workers.
 * El build de React se sirve como static assets; solo /api/* llega a este código
 * (ver "run_worker_first" en wrangler.jsonc). Mismo núcleo que Express: core/check.ts.
 */
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { loadConfig } from './config.js';
import { handleCheck } from './core/check.js';
import { FixedWindowRateLimiter, TOO_MANY_REQUESTS } from './core/rateLimit.js';
import { API_SECURITY_HEADERS } from './core/securityHeaders.js';
import { selectProvider, type DiagnosticProvider } from './providers/index.js';
import type { ApiError } from './schemas/index.js';

export type WorkerEnv = Record<string, string | undefined>;

export interface WorkerDeps {
  provider: DiagnosticProvider;
  timeoutMs: number;
  limiter: FixedWindowRateLimiter;
}

export function createWorkerApp(resolveDeps: (env: WorkerEnv) => WorkerDeps) {
  const app = new Hono<{ Bindings: WorkerEnv }>();

  app.use('/api/*', async (c, next) => {
    await next();
    for (const [k, v] of Object.entries(API_SECURITY_HEADERS)) c.header(k, v);
  });

  app.get('/api/health', (c) => c.json({ status: 'ok', provider: resolveDeps(c.env).provider.name }));

  app.post(
    '/api/maintenance/check',
    bodyLimit({ maxSize: 16 * 1024, onError: (c) => c.json({ error: 'Solicitud demasiado grande' } satisfies ApiError, 413) }),
    async (c) => {
      const deps = resolveDeps(c.env);
      const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
      const decision = deps.limiter.hit(ip);
      c.header('RateLimit-Remaining', String(decision.remaining));
      if (!decision.allowed) {
        c.header('Retry-After', String(decision.retryAfterSec));
        return c.json(TOO_MANY_REQUESTS, 429);
      }

      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: 'El cuerpo de la solicitud no es JSON válido' } satisfies ApiError, 400);
      }
      const result = await handleCheck(deps.provider, body, deps.timeoutMs);
      return c.json(result.body, result.status as ContentfulStatusCode);
    },
  );

  app.all('/api/*', (c) => c.json({ error: 'Ruta no encontrada' } satisfies ApiError, 404));
  return app;
}

// Las dependencias se crean una vez por isolate, a partir de las variables y secretos del Worker.
let cached: WorkerDeps | undefined;

export default createWorkerApp((env) => {
  if (!cached) {
    const config = loadConfig(env);
    cached = {
      provider: selectProvider(config),
      timeoutMs: config.AI_TIMEOUT_MS,
      limiter: new FixedWindowRateLimiter(config.RATE_LIMIT_MAX, config.RATE_LIMIT_WINDOW_MS),
    };
  }
  return cached;
});
