import type { DiagnosticResponse, MaintenanceRequest } from '../schemas/index.js';

/**
 * Contrato de cualquier motor de diagnostico.
 * Hoy: motor de reglas local. Manana: Claude API (misma interfaz, mismo JSON de salida).
 */
export interface DiagnosticProvider {
  readonly name: string;
  diagnose(request: MaintenanceRequest, signal: AbortSignal): Promise<DiagnosticResponse>;
}
