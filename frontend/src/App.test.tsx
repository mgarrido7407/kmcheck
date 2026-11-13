import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { sampleDiagnostic } from './test/fixtures';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function submitValidForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/marca/i), 'Chevrolet');
  await user.type(screen.getByLabelText(/modelo/i), 'Spark');
  await user.selectOptions(screen.getByLabelText(/año/i), '2018');
  await user.type(screen.getByLabelText(/kilometraje/i), '60000');
  await user.type(screen.getByLabelText(/obd-ii/i), 'P0300');
  await user.click(screen.getByRole('button', { name: /revisar/i }));
}

describe('App (integracion con la API mockeada)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('solo llama a POST /api/maintenance/check, muestra carga y luego el diagnostico', async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await submitValidForm();

    expect(screen.getByRole('status', { name: /cargando/i })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/maintenance/check');
    expect(init.method).toBe('POST');
    expect(JSON.stringify(init.headers)).not.toMatch(/x-api-key|authorization/i);

    resolve(jsonResponse(200, sampleDiagnostic));
    expect(await screen.findByRole('region', { name: /resultado del diagnóstico/i })).toBeInTheDocument();
  });

  it('muestra un mensaje amigable cuando el servicio responde 503', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(503, { error: 'El servicio de diagnóstico no está disponible en este momento.' })),
    );
    render(<App />);
    await submitValidForm();
    expect(await screen.findByText(/no está disponible/i)).toBeInTheDocument();
  });

  it('muestra error de conexion si la red falla', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    render(<App />);
    await submitValidForm();
    expect(await screen.findByText(/no se pudo conectar/i)).toBeInTheDocument();
  });

  it('guarda consultas recientes en localStorage y permite limpiar el historial', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, sampleDiagnostic)));
    render(<App />);
    await submitValidForm();
    expect(await screen.findByRole('region', { name: /consultas recientes/i })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: /limpiar/i }));
    expect(screen.queryByRole('region', { name: /consultas recientes/i })).not.toBeInTheDocument();
  });
});
