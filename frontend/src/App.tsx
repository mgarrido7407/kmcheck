import type { DiagnosticResponse, MaintenanceRequest } from '@kmcheck/shared';
import { Gauge, History, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { DiagnosticCard, DiagnosticSkeleton } from './components/DiagnosticCard';
import { UrgencyBadge } from './components/UrgencyBadge';
import { VehicleForm } from './components/VehicleForm';
import { useDiagnosticHistory } from './hooks/useDiagnosticHistory';
import { ApiRequestError, checkMaintenance } from './services/maintenanceApi';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; result: DiagnosticResponse }
  | { kind: 'error'; message: string; fieldErrors: Record<string, string> };

export default function App() {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const inFlight = useRef<AbortController | null>(null);
  const { history, addEntry, clearHistory } = useDiagnosticHistory();

  const handleSubmit = async (data: MaintenanceRequest) => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setState({ kind: 'loading' });
    try {
      const result = await checkMaintenance(data, controller.signal);
      addEntry(result);
      setState({ kind: 'success', result });
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof ApiRequestError ? err.message : 'Ocurrió un error inesperado.';
      const fieldErrors = err instanceof ApiRequestError ? err.fieldErrors : {};
      setState({ kind: 'error', message, fieldErrors });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-center gap-3 print:mb-4">
        <Gauge aria-hidden="true" className="h-8 w-8 text-sky-600" />
        <div>
          <h1 className="text-2xl font-bold">KmCheck</h1>
          <p className="text-sm text-slate-500">Diagnóstico y mantenimiento vehicular</p>
        </div>
      </header>

      <main className="grid gap-6 lg:grid-cols-2 print:block">
        <div className="space-y-4 print:hidden">
          <VehicleForm
            onSubmit={handleSubmit}
            loading={state.kind === 'loading'}
            serverErrors={state.kind === 'error' ? state.fieldErrors : undefined}
          />

          {history.length > 0 && (
            <section aria-label="Consultas recientes" className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <History aria-hidden="true" className="h-4 w-4 text-slate-500" /> Consultas recientes
                </h2>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" /> Limpiar
                </button>
              </div>
              <ul className="divide-y divide-slate-100">
                {history.map((item) => (
                  <li key={item.generatedAt}>
                    <button
                      type="button"
                      onClick={() => setState({ kind: 'success', result: item })}
                      className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm hover:text-sky-700"
                    >
                      <span className="truncate font-medium">
                        {item.vehicle.make} {item.vehicle.model} {item.vehicle.year} ·{' '}
                        {item.vehicle.mileageKm.toLocaleString('es-CO')} km
                      </span>
                      <UrgencyBadge urgency={item.overallStatus} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

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
