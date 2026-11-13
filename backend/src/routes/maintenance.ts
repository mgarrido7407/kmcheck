import { Router } from 'express';
import { createCheckHandler } from '../controllers/maintenanceController.js';
import type { FixedWindowRateLimiter } from '../core/rateLimit.js';
import { rateLimit } from '../middleware/rateLimit.js';
import type { DiagnosticProvider } from '../providers/index.js';

export function maintenanceRouter(provider: DiagnosticProvider, timeoutMs: number, limiter: FixedWindowRateLimiter): Router {
  const router = Router();
  router.post('/check', rateLimit(limiter), createCheckHandler(provider, timeoutMs));
  return router;
}
