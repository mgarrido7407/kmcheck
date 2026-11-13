import type { RequestHandler } from 'express';
import { FixedWindowRateLimiter, TOO_MANY_REQUESTS } from '../core/rateLimit.js';

export function rateLimit(limiter: FixedWindowRateLimiter): RequestHandler {
  return (req, res, next) => {
    const decision = limiter.hit(req.ip ?? 'unknown');
    res.setHeader('RateLimit-Remaining', String(decision.remaining));
    if (!decision.allowed) {
      res.setHeader('Retry-After', String(decision.retryAfterSec));
      res.status(429).json(TOO_MANY_REQUESTS);
      return;
    }
    next();
  };
}
