import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { RulesProvider } from '../src/providers/rulesProvider.js';

describe('E2E HTTP real (Express + RulesProvider)', () => {
  const app = createApp({ provider: new RulesProvider(), trustProxy: true, rateLimit: { max: 2, windowMs: 60_000 } });
  let server: ReturnType<typeof app.listen>;
  let baseUrl = '';

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  it('responde /api/health y procesa un diagnóstico completo', async () => {
    const health = await fetch(`${baseUrl}/api/health`);
    expect(health.status).toBe(200);
    const healthBody = (await health.json()) as { status: string; provider: string; uptimeSec: number };
    expect(healthBody.status).toBe('ok');
    expect(healthBody.provider).toBe('rules-engine');
    expect(typeof healthBody.uptimeSec).toBe('number');

    const check = await fetch(`${baseUrl}/api/maintenance/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.10' },
      body: JSON.stringify({
        make: 'Chevrolet',
        model: 'Spark',
        year: 2018,
        mileageKm: 60000,
        obdCodes: ['P0340'],
        symptoms: 'arranque lento',
      }),
    });
    expect(check.status).toBe(200);
    const body = (await check.json()) as { overallStatus: string; alerts: Array<{ code?: string }> };
    expect(body.overallStatus).toBe('red');
    expect(body.alerts.some((a) => a.code === 'P0340')).toBe(true);
  });

  it('aisla rate limit por IP real cuando trustProxy está activo', async () => {
    const reqInit = (ip: string): RequestInit => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify({ make: 'Mazda', model: '3', year: 2020, mileageKm: 20000 }),
    });

    expect((await fetch(`${baseUrl}/api/maintenance/check`, reqInit('198.51.100.1'))).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/maintenance/check`, reqInit('198.51.100.1'))).status).toBe(200);
    expect((await fetch(`${baseUrl}/api/maintenance/check`, reqInit('198.51.100.1'))).status).toBe(429);
    // Otra IP distinta sigue teniendo su propia cuota
    expect((await fetch(`${baseUrl}/api/maintenance/check`, reqInit('198.51.100.2'))).status).toBe(200);
  });
});
