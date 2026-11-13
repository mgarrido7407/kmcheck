import { diagnose } from '../engine/diagnose.js';
import type { DiagnosticResponse, MaintenanceRequest } from '../schemas/index.js';
import type { DiagnosticProvider } from './types.js';

export class RulesProvider implements DiagnosticProvider {
  readonly name = 'rules-engine';

  async diagnose(request: MaintenanceRequest): Promise<DiagnosticResponse> {
    return diagnose(request);
  }
}
