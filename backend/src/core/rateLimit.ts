import type { ApiError } from '../schemas/index.js';

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export const TOO_MANY_REQUESTS: ApiError = {
  error: 'Demasiadas solicitudes. Espera un momento antes de volver a intentarlo.',
};

/**
 * Limitador de ventana fija en memoria, por clave (IP).
 * Suficiente para un solo proceso o isolate; con varias instancias cada una cuenta por separado.
 */
export class FixedWindowRateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  hit(key: string): RateLimitDecision {
    const t = this.now();
    if (this.hits.size > 10_000) this.sweep(t);
    let entry = this.hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + this.windowMs };
      this.hits.set(key, entry);
    }
    entry.count++;
    return {
      allowed: entry.count <= this.max,
      remaining: Math.max(0, this.max - entry.count),
      retryAfterSec: Math.ceil((entry.resetAt - t) / 1000),
    };
  }

  private sweep(t: number) {
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k);
  }
}
