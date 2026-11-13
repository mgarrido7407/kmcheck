import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { sampleDiagnostic } from '../test/fixtures';
import { DiagnosticCard, groupServices } from './DiagnosticCard';

describe('DiagnosticCard', () => {
  it('muestra vehiculo, estado general con texto (no solo color) y resumen', () => {
    render(<DiagnosticCard result={sampleDiagnostic} />);
    expect(screen.getByRole('heading', { name: /chevrolet spark 2018/i })).toBeInTheDocument();
    expect(screen.getAllByText('Urgente').length).toBeGreaterThan(0);
    expect(screen.getByText(sampleDiagnostic.summary)).toBeInTheDocument();
  });

  it('lista alertas con su codigo OBD y servicios recomendados', () => {
    render(<DiagnosticCard result={sampleDiagnostic} />);
    expect(screen.getByText(/OBD-II · P0300/)).toBeInTheDocument();
    const services = screen.getByRole('heading', { name: /servicios recomendados/i }).parentElement!;
    expect(within(services).getByText('Cambio de bujías')).toBeInTheDocument();
    expect(within(services).getByText('OK')).toBeInTheDocument();
  });

  it('dispara window.print al pulsar Imprimir / PDF', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<DiagnosticCard result={sampleDiagnostic} />);
    fireEvent.click(screen.getByRole('button', { name: /imprimir \/ pdf/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });
});

describe('groupServices / agrupación por kilometraje', () => {
  const svc = (id: string, urgency: 'red' | 'yellow' | 'green', dueAtKm?: number) => ({
    id,
    name: `Servicio ${id}`,
    reason: 'r',
    urgency,
    ...(dueAtKm !== undefined ? { dueAtKm } : {}),
  });

  it('deja lo urgente suelto y primero, y agrupa 3+ tareas del mismo kilometraje', () => {
    const entries = groupServices([
      svc('a', 'yellow', 60000),
      svc('b', 'yellow', 60000),
      svc('plugs', 'red', 60000),
      svc('c', 'green', 60000),
      svc('battery', 'yellow'),
      svc('d', 'yellow', 70000),
    ]);
    expect(entries[0]).toMatchObject({ kind: 'single', service: { id: 'plugs' } });
    expect(entries[1]).toMatchObject({ kind: 'group', dueAtKm: 60000 });
    expect(entries[1]!.kind === 'group' && entries[1]!.services.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    // 70.000 km tiene una sola tarea: no se agrupa
    expect(entries.filter((e) => e.kind === 'single').map((e) => e.kind === 'single' && e.service.id)).toEqual(['plugs', 'd', 'battery']);
  });

  it('muestra el grupo plegable con el número de tareas', () => {
    render(
      <DiagnosticCard
        result={{
          ...sampleDiagnostic,
          services: [svc('a', 'yellow', 60000), svc('b', 'yellow', 60000), svc('c', 'green', 60000)],
        }}
      />,
    );
    expect(screen.getByText(/mantenimiento de los 60\.000 km/i)).toBeInTheDocument();
    expect(screen.getByText(/3 tareas/)).toBeInTheDocument();
  });
});
