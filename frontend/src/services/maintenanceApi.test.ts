import type { MaintenanceRequest } from '@kmcheck/shared';
import { describe, expect, it, vi } from 'vitest';
import { sampleDiagnostic } from '../test/fixtures';
import { ApiRequestError, checkMaintenance } from './maintenanceApi';

const body: MaintenanceRequest = { make: 'Mazda', model: '3', year: 2020, mileageKm: 1000, symptoms: '', obdCodes: [] };

describe('checkMaintenance', () => {
  it('devuelve el diagnóstico validado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(sampleDiagnostic), { status: 200 })));
    await expect(checkMaintenance(body)).resolves.toEqual(sampleDiagnostic);
  });

  it('corta la espera con un timeout propio del cliente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          }),
      ),
    );
    await expect(checkMaintenance(body, undefined, 20)).rejects.toThrow(/tardó demasiado/);
  });

  it('propaga el mensaje del servidor en un 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'Demasiadas solicitudes.' }), { status: 429 })),
    );
    const err = await checkMaintenance(body).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ status: 429, message: 'Demasiadas solicitudes.' });
  });

  it('rechaza respuestas que no cumplen el contrato', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ foo: 1 }), { status: 200 })));
    await expect(checkMaintenance(body)).rejects.toThrow(/formato inesperado/);
  });
});
