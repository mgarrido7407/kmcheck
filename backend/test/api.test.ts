import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { FixedWindowRateLimiter } from '../src/core/rateLimit.js';
import { RulesProvider } from '../src/providers/rulesProvider.js';
import type { DiagnosticProvider } from '../src/providers/types.js';
import { DiagnosticResponseSchema } from '../src/schemas/index.js';
import { createWorkerApp } from '../src/worker.js';

/**
 * Tests de contrato: los MISMOS casos se ejecutan contra el adaptador Express (desarrollo local)
 * y contra el Worker de Cloudflare (producción), para que ambos se comporten igual.
 */
interface Res {
  status: number;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  header: (name: string) => string | undefined;
}
type Call = (method: 'GET' | 'POST', path: string, body?: unknown, rawBody?: string) => Promise<Res>;
interface Opts {
  provider: DiagnosticProvider;
  timeoutMs?: number;
  rateMax?: number;
}

const viaExpress = ({ provider, timeoutMs = 1000, rateMax = 100 }: Opts): Call => {
  const app = createApp({ provider, timeoutMs, rateLimit: { max: rateMax, windowMs: 60000 } });
  return async (method, path, body, rawBody) => {
    let req = method === 'GET' ? request(app).get(path) : request(app).post(path);
    if (rawBody !== undefined) req = req.set('Content-Type', 'application/json').send(rawBody);
    else if (body !== undefined) req = req.send(body as object);
    const res = await req;
    return { status: res.status, body: res.body, header: (n) => res.headers[n.toLowerCase()] as string | undefined };
  };
};

const viaWorker = ({ provider, timeoutMs = 1000, rateMax = 100 }: Opts): Call => {
  const limiter = new FixedWindowRateLimiter(rateMax, 60000);
  const app = createWorkerApp(() => ({ provider, timeoutMs, limiter }));
  return async (method, path, body, rawBody) => {
    const res = await app.request(path, {
      method,
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '203.0.113.7' },
      body: method === 'POST' ? (rawBody ?? JSON.stringify(body)) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, header: (n) => res.headers.get(n) ?? undefined };
  };
};

const validBody = { make: 'Chevrolet', model: 'Spark', year: 2018, mileageKm: 60000, obdCodes: ['P0300'] };

function spyProvider(impl?: DiagnosticProvider['diagnose']) {
  const rules = new RulesProvider();
  return { name: 'spy', diagnose: vi.fn(impl ?? ((r) => rules.diagnose(r))) } satisfies DiagnosticProvider;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe.each([
  ['Express', viaExpress],
  ['Cloudflare Worker', viaWorker],
])('Contrato API (%s)', (_name, make) => {
  it('200: devuelve un diagnóstico que cumple el contrato', async () => {
    const res = await make({ provider: spyProvider() })('POST', '/api/maintenance/check', validBody);
    expect(res.status).toBe(200);
    expect(() => DiagnosticResponseSchema.parse(res.body)).not.toThrow();
    expect(res.body.overallStatus).toBe('red');
  });

  it('400: kilometraje negativo, sin llamar al proveedor', async () => {
    const provider = spyProvider();
    const res = await make({ provider })('POST', '/api/maintenance/check', { ...validBody, mileageKm: -10 });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'mileageKm' })]));
    expect(provider.diagnose).not.toHaveBeenCalled();
  });

  it('400: campos requeridos faltantes', async () => {
    const provider = spyProvider();
    const res = await make({ provider })('POST', '/api/maintenance/check', { year: 2020 });
    expect(res.status).toBe(400);
    const fields = res.body.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['make', 'model', 'mileageKm']));
    expect(provider.diagnose).not.toHaveBeenCalled();
  });

  it('400: JSON mal formado', async () => {
    const provider = spyProvider();
    const res = await make({ provider })('POST', '/api/maintenance/check', undefined, '{"make":');
    expect(res.status).toBe(400);
    expect(provider.diagnose).not.toHaveBeenCalled();
  });

  it('503: el proveedor falla; no se filtran detalles y el log redacta secretos', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider = spyProvider(async () => {
      throw new Error('ECONNRESET upstream api_key=sk-ant-secret123');
    });
    const res = await make({ provider })('POST', '/api/maintenance/check', validBody);
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNRESET|sk-ant|secret/);
    const logged = errSpy.mock.calls.flat().join(' ');
    expect(logged).toContain('ECONNRESET');
    expect(logged).not.toContain('sk-ant-secret123');
  });

  it('503: el proveedor excede el tiempo de espera', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider = spyProvider(() => new Promise(() => {}));
    const res = await make({ provider, timeoutMs: 50 })('POST', '/api/maintenance/check', validBody);
    expect(res.status).toBe(503);
  });

  it('503: el proveedor devuelve una respuesta que no cumple el contrato', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const provider = spyProvider(async () => ({ nonsense: true }) as never);
    const res = await make({ provider })('POST', '/api/maintenance/check', validBody);
    expect(res.status).toBe(503);
  });

  it('429: limita la tasa de solicitudes por cliente', async () => {
    const provider = spyProvider();
    const call = make({ provider, rateMax: 2 });
    expect((await call('POST', '/api/maintenance/check', validBody)).status).toBe(200);
    expect((await call('POST', '/api/maintenance/check', validBody)).status).toBe(200);
    const blocked = await call('POST', '/api/maintenance/check', validBody);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.header('Retry-After'))).toBeGreaterThan(0);
    expect(provider.diagnose).toHaveBeenCalledTimes(2);
  });

  it('GET /api/health', async () => {
    const res = await make({ provider: new RulesProvider() })('GET', '/api/health');
    expect(res.body).toMatchObject({ status: 'ok', provider: 'rules-engine' });
    expect(typeof (res.body as { uptimeSec?: unknown }).uptimeSec).toBe('number');
  });

  it('envía cabeceras de seguridad y no expone x-powered-by', async () => {
    const res = await make({ provider: new RulesProvider() })('GET', '/api/health');
    expect(res.header('X-Content-Type-Options')).toBe('nosniff');
    expect(res.header('X-Frame-Options')).toBe('DENY');
    expect(res.header('x-powered-by')).toBeUndefined();
  });

  it('404 en rutas /api desconocidas', async () => {
    const res = await make({ provider: new RulesProvider() })('GET', '/api/no-existe');
    expect(res.status).toBe(404);
  });
});

describe('FixedWindowRateLimiter', () => {
  it('reinicia el conteo al cambiar de ventana', () => {
    let t = 0;
    const limiter = new FixedWindowRateLimiter(1, 1000, () => t);
    expect(limiter.hit('a').allowed).toBe(true);
    expect(limiter.hit('a').allowed).toBe(false);
    expect(limiter.hit('b').allowed).toBe(true);
    t = 1000;
    expect(limiter.hit('a').allowed).toBe(true);
  });
});
