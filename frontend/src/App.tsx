import type { DiagnosticResponse, MaintenanceRequest } from '@kmcheck/shared';
import { Gauge } from 'lucide-react';
import { useRef, useState } from 'react';
import { DiagnosticCard, DiagnosticSkeleton } from './components/DiagnosticCard';
import { VehicleForm } from './components/VehicleForm';
import { ApiRequestError, checkMaintenance } from './services/maintenanceApi';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; result: DiagnosticResponse }
  | { kind: 'error'; message: string; fieldErrors: Record<string, string> };

export default function App() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const inFlight = useRef<AbortController | null>(null);

  const handleSubmit = async (data: MaintenanceRequest) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setState({ kind: 'loading' });
    try {
      const result = await checkMaintenance(data, controller.signal);
      setState({ kind: 'success', result });
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof ApiRequestError ? err.message : 'Ocurrió un error inesperado.';
      const fieldErrors = err instanceof ApiRequestError ? err.fieldErrors : {};
      setState({ kind: 'error', message, fieldErrors });
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center gap-3">
        <Gauge aria-hidden="true" className="h-8 w-8 text-sky-600" />
        <div>
          <h1 className="text-2xl font-bold">KmCheck</h1>
          <p className="text-sm text-slate-500">Diagnóstico y mantenimiento vehicular</p>
        </div>
      </header>

      <main className="grid gap-6 lg:grid-cols-2">
        <VehicleForm
          onSubmit={handleSubmit}
          loading={state.kind === 'loading'}
          serverErrors={state.kind === 'error' ? state.fieldErrors : undefined}
        />

        <div aria-live="polite">
          {state.kind === 'idle' && (
            <div className="flex h-full min-h-48 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              Completa los datos del vehículo para obtener un diagnóstico.
            </div>
          )}
          {state.kind === 'loading' && <DiagnosticSkeleton />}
          {state.kind === 'error' && (
            <div role="alert" className="rounded-2xl bg-red-50 p-6 text-sm text-red-800 ring-1 ring-red-200">
              {state.message}
            </div>
          )}
          {state.kind === 'success' && <DiagnosticCard result={state.result} />}
        </div>
      </main>
    </div>
  );
}
