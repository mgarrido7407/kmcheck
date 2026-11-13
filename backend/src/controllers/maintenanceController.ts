import type { RequestHandler } from 'express';
import { handleCheck } from '../core/check.js';
import type { DiagnosticProvider } from '../providers/index.js';

/** Adaptador Express del núcleo framework-agnóstico (ver core/check.ts). */
export function createCheckHandler(provider: DiagnosticProvider, timeoutMs: number): RequestHandler {
  return async (req, res) => {
    const result = await handleCheck(provider, req.body, timeoutMs);
    res.status(result.status).json(result.body);
  };
}
