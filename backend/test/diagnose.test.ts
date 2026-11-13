import { describe, expect, it } from 'vitest';
import { diagnose } from '../src/engine/diagnose.js';
import { lookupObd } from '../src/engine/obdCodes.js';
import { matchSymptoms } from '../src/engine/symptoms.js';
import { DiagnosticResponseSchema, MaintenanceRequestSchema } from '../src/schemas/index.js';

const NOW = new Date('2026-06-01T00:00:00Z');
const req = (over: Record<string, unknown> = {}) =>
  MaintenanceRequestSchema.parse({ make: 'Mazda', model: '3', year: 2023, mileageKm: 5000, ...over });

describe('motor de reglas: diagnose', () => {
  it('cumple el contrato DiagnosticResponse', () => {
    const r = diagnose(req(), NOW);
    expect(() => DiagnosticResponseSchema.parse(r)).not.toThrow();
    expect(r.generatedBy).toBe('rules-engine');
  });

  it('vehiculo nuevo sin hallazgos queda en verde', () => {
    const r = diagnose(req({ mileageKm: 3000, year: 2026 }), NOW);
    expect(r.overallStatus).toBe('green');
    expect(r.alerts).toHaveLength(0);
  });

  it('caso de aceptacion: 60.000 km + P0300 => rojo y bujias urgentes', () => {
    const r = diagnose(req({ mileageKm: 60000, obdCodes: ['P0300'] }), NOW);
    expect(r.overallStatus).toBe('red');
    expect(r.alerts[0]).toMatchObject({ code: 'P0300', urgency: 'red', source: 'obd' });
    const plugs = r.services.find((s) => s.id === 'spark-plugs');
    expect(plugs?.urgency).toBe('red');
    expect(plugs?.reason).toContain('P0300');
  });

  it('marca servicios proximos por kilometraje', () => {
    const r = diagnose(req({ mileageKm: 9500 }), NOW);
    const oil = r.services.find((s) => s.id === 'oil-change');
    expect(oil).toMatchObject({ urgency: 'yellow', dueAtKm: 10000 });
  });

  it('marca bateria por antiguedad', () => {
    const r = diagnose(req({ year: 2019, mileageKm: 15000 }), NOW);
    expect(r.services.find((s) => s.id === 'battery')?.urgency).toBe('yellow');
  });

  it('detecta sintomas en espanol, sin importar acentos ni mayusculas', () => {
    const r = diagnose(req({ symptoms: 'El carro SE CALIENTA y sale HUMO BLANCO' }), NOW);
    const ids = r.alerts.map((a) => a.id);
    expect(ids).toContain('symptom-overheating');
    expect(ids).toContain('symptom-white-smoke');
    expect(r.overallStatus).toBe('red');
  });

  it('avisa cuando no reconoce los sintomas', () => {
    const r = diagnose(req({ symptoms: 'algo raro' }), NOW);
    expect(r.alerts.map((a) => a.id)).toContain('symptom-unrecognized');
  });

  it('ordena alertas de mayor a menor urgencia', () => {
    const r = diagnose(req({ obdCodes: ['P0442', 'P0300', 'P0420'] }), NOW);
    expect(r.alerts.map((a) => a.urgency)).toEqual(['red', 'yellow', 'green']);
  });

  it('alerta por alto kilometraje', () => {
    const r = diagnose(req({ mileageKm: 300500 }), NOW);
    expect(r.alerts.map((a) => a.id)).toContain('high-mileage');
  });

  it('no duplica codigos repetidos', () => {
    const r = diagnose(req({ obdCodes: ['P0300', 'p0300'] }), NOW);
    expect(r.alerts.filter((a) => a.code === 'P0300')).toHaveLength(1);
  });
});

describe('lookupObd', () => {
  it('devuelve entrada generica para codigos desconocidos', () => {
    const e = lookupObd('P1234');
    expect(e.known).toBe(false);
    expect(e.detail).toContain('fabricante');
  });
});

describe('matchSymptoms', () => {
  it('ignora texto vacio', () => {
    expect(matchSymptoms('   ')).toEqual([]);
  });
});
