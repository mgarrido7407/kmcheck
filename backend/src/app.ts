import cors from 'cors';
import express, { type Express } from 'express';
import { FixedWindowRateLimiter } from './core/rateLimit.js';
import { API_SECURITY_HEADERS } from './core/securityHeaders.js';
import { errorHandler } from './middleware/errorHandler.js';
import type { DiagnosticProvider } from './providers/index.js';
import { maintenanceRouter } from './routes/maintenance.js';

export interface AppOptions {
  provider: DiagnosticProvider;
  timeoutMs?: number;
  corsOrigin?: string;
  rateLimit?: { max: number; windowMs: number };
}

export function createApp({
  provider,
  timeoutMs = 30000,
  corsOrigin = 'http://localhost:3000',
  rateLimit = { max: 20, windowMs: 60000 },
}: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    for (const [k, v] of Object.entries(API_SECURITY_HEADERS)) res.setHeader(k, v);
    next();
  });
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', provider: provider.name });
  });
  app.use('/api/maintenance', maintenanceRouter(provider, timeoutMs, new FixedWindowRateLimiter(rateLimit.max, rateLimit.windowMs)));

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });
  app.use(errorHandler);
  return app;
}
