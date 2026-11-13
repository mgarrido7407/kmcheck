import { describe, expect, it } from 'vitest';
import { MaintenanceRequestSchema, worstUrgency } from './index';

const valid = { make: 'Toyota', model: 'Corolla', year: 2018, mileageKm: 60000 };

describe('MaintenanceRequestSchema', () => {
  it('acepta una solicitud minima y aplica defaults', () => {
    const r = MaintenanceRequestSchema.parse(valid);
    expect(r.symptoms).toBe('');
    expect(r.obdCodes).toEqual([]);
  });

  it('normaliza codigos OBD-II a mayusculas', () => {
    const r = MaintenanceRequestSchema.parse({ ...valid, obdCodes: [' p0300 '] });
    expect(r.obdCodes).toEqual(['P0300']);
  });

  it('rechaza kilometraje negativo', () => {
    const r = MaintenanceRequestSchema.safeParse({ ...valid, mileageKm: -5 });
    expect(r.success).toBe(false);
  });

  it('rechaza campos requeridos vacios', () => {
    const r = MaintenanceRequestSchema.safeParse({ ...valid, make: '  ' });
    expect(r.success).toBe(false);
  });

  it('rechaza codigos OBD-II mal formados', () => {
    const r = MaintenanceRequestSchema.safeParse({ ...valid, obdCodes: ['X1234'] });
    expect(r.success).toBe(false);
  });

  it('rechaza anos futuros', () => {
    const r = MaintenanceRequestSchema.safeParse({ ...valid, year: new Date().getFullYear() + 5 });
    expect(r.success).toBe(false);
  });
});

describe('worstUrgency', () => {
  it('devuelve la peor urgencia', () => {
    expect(worstUrgency([])).toBe('green');
    expect(worstUrgency(['green', 'yellow'])).toBe('yellow');
    expect(worstUrgency(['yellow', 'red', 'green'])).toBe('red');
  });
});
