import type { DiagnosticResponse } from '@kmcheck/shared';

export const sampleDiagnostic: DiagnosticResponse = {
  vehicle: { make: 'Chevrolet', model: 'Spark', year: 2018, mileageKm: 60000 },
  overallStatus: 'red',
  summary: 'Atención inmediata: 2 hallazgo(s) crítico(s).',
  alerts: [
    {
      id: 'obd-P0300',
      title: 'Fallo de encendido aleatorio / múltiple',
      detail: 'El motor no está quemando el combustible correctamente.',
      urgency: 'red',
      source: 'obd',
      code: 'P0300',
    },
  ],
  services: [
    { id: 'spark-plugs', name: 'Cambio de bujías', reason: 'Relacionado con el codigo P0300', urgency: 'red', dueAtKm: 60000 },
    { id: 'oil-change', name: 'Cambio de aceite y filtro', reason: 'Lubricacion', urgency: 'green', dueAtKm: 70000 },
  ],
  generatedBy: 'rules-engine',
  generatedAt: '2026-11-12T00:00:00.000Z',
  disclaimer: 'Diagnóstico orientativo.',
};
