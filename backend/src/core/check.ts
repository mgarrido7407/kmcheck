import { logger } from '../logger.js';
import type { DiagnosticProvider } from '../providers/types.js';
import {
  DiagnosticResponseSchema,
  MaintenanceRequestSchema,
  type ApiError,
  type DiagnosticResponse,
} from '../schemas/index.js';

/**
 * Lógica HTTP independiente del framework: la usan tanto Express (local) como el Worker
 * de Cloudflare (producción), para que ambos se comporten exactamente igual.
 */
export interface HttpResult<T = unknown> {
  status: number;
  body: T;
}

export class ProviderTimeoutError extends Error {
  constructor(ms: number) {
    super(`El proveedor de diagnóstico excedió ${ms} ms`);
    this.name = 'ProviderTimeoutError';
  }
}

export const SERVICE_UNAVAILABLE: ApiError = {
  error: 'El servicio de diagnóstico no está disponible en este momento. Intenta de nuevo en unos minutos.',
};

export async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderTimeoutError(ms));
    }, ms);
  });
  try {
    return await Promise.race([fn(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Valida la entrada (400 sin tocar el proveedor), invoca el proveedor con timeout y garantiza el contrato (503 si falla). */
export async function handleCheck(
  provider: DiagnosticProvider,
  rawBody: unknown,
  timeoutMs: number,
): Promise<HttpResult<DiagnosticResponse | ApiError>> {
  const parsed = MaintenanceRequestSchema.safeParse(rawBody ?? {});
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        error: 'Solicitud inválida',
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.') || '(body)',
          message: i.message,
        })),
      },
    };
  }

  try {
    const raw = await withTimeout((signal) => provider.diagnose(parsed.data, signal), timeoutMs);
    // Garantiza el contrato de salida aunque el proveedor (p. ej. un LLM) devuelva algo inesperado.
    const result = DiagnosticResponseSchema.parse(raw);
    logger.info('Diagnóstico generado', { provider: provider.name, status: result.overallStatus });
    return { status: 200, body: result };
  } catch (err) {
    // Detalle completo solo en los logs del servidor; al cliente, un mensaje genérico.
    logger.error(`Fallo del proveedor "${provider.name}"`, err);
    return { status: 503, body: SERVICE_UNAVAILABLE };
  }
}
