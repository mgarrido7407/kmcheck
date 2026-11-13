import {
  ApiErrorSchema,
  DiagnosticResponseSchema,
  type DiagnosticResponse,
  type MaintenanceRequest,
} from '@kmcheck/shared';

/**
 * Adaptador de red hacia la API. El frontend NUNCA llama a un proveedor de IA:
 * la única petición visible en DevTools es POST /api/maintenance/check (mismo origen).
 */
export const CHECK_ENDPOINT = '/api/maintenance/check';

/** Debe ser mayor que el timeout del servidor (AI_TIMEOUT_MS) para que el 503 llegue antes. */
export const CLIENT_TIMEOUT_MS = 45_000;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export async function checkMaintenance(
  body: MaintenanceRequest,
  signal?: AbortSignal,
  timeoutMs: number = CLIENT_TIMEOUT_MS,
): Promise<DiagnosticResponse> {
  // Une la cancelación externa (nueva consulta) con un timeout propio del cliente.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener('abort', onExternalAbort);

  try {
    let res: Response;
    try {
      res = await fetch(CHECK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (timedOut) throw new ApiRequestError('El servidor tardó demasiado en responder. Intenta de nuevo.', 0);
      if (signal?.aborted) throw err;
      throw new ApiRequestError('No se pudo conectar con el servidor. Verifica tu conexión.', 0);
    }

    const json: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const parsed = ApiErrorSchema.safeParse(json);
      const message = parsed.success ? parsed.data.error : `Error inesperado (${res.status})`;
      const fieldErrors = Object.fromEntries(
        (parsed.success ? (parsed.data.details ?? []) : []).map((d) => [d.field, d.message]),
      );
      throw new ApiRequestError(message, res.status, fieldErrors);
    }

    const parsed = DiagnosticResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new ApiRequestError('El servidor devolvió una respuesta con un formato inesperado.', res.status);
    }
    return parsed.data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onExternalAbort);
  }
}
