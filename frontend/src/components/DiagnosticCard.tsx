import { worstUrgency, type DiagnosticResponse, type Service } from '@kmcheck/shared';
import { Activity, ChevronDown, Printer, Wrench } from 'lucide-react';
import { UrgencyBadge } from './UrgencyBadge';

/** A partir de cuántas tareas con el mismo kilometraje se agrupan en un solo "servicio de X km". */
export const GROUP_MIN_SIZE = 3;

type ServiceEntry = { kind: 'single'; service: Service } | { kind: 'group'; dueAtKm: number; services: Service[] };

/**
 * Reduce el ruido visual: lo urgente (rojo) siempre va suelto y primero;
 * el resto se agrupa por kilometraje cuando coinciden varias tareas (p. ej. el servicio de 60.000 km).
 */
export function groupServices(services: Service[]): ServiceEntry[] {
  const urgent: ServiceEntry[] = [];
  const byKm = new Map<number, Service[]>();
  const loose: Service[] = [];
  for (const s of services) {
    if (s.urgency === 'red') urgent.push({ kind: 'single', service: s });
    else if (s.dueAtKm !== undefined) byKm.set(s.dueAtKm, [...(byKm.get(s.dueAtKm) ?? []), s]);
    else loose.push(s);
  }
  const rest: ServiceEntry[] = [];
  for (const [dueAtKm, list] of byKm) {
    if (list.length >= GROUP_MIN_SIZE) rest.push({ kind: 'group', dueAtKm, services: list });
    else for (const s of list) rest.push({ kind: 'single', service: s });
  }
  for (const s of loose) rest.push({ kind: 'single', service: s });
  return [...urgent, ...rest];
}

function ServiceItem({ service: s, compact = false }: { service: Service; compact?: boolean }) {
  return (
    <li className={`flex flex-wrap items-start gap-2 ${compact ? 'px-3 py-2 pl-6' : 'p-3'}`}>
      <UrgencyBadge urgency={s.urgency} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{s.name}</p>
        <p className="text-sm text-slate-600">{s.reason}</p>
      </div>
      {s.dueAtKm !== undefined && !compact && (
        <span className="text-xs whitespace-nowrap text-slate-500">{s.dueAtKm.toLocaleString('es-CO')} km</span>
      )}
    </li>
  );
}

const SOURCE_LABEL = { obd: 'OBD-II', symptom: 'Síntoma', schedule: 'Plan' } as const;

const STATUS_BORDER = {
  red: 'border-l-red-500',
  yellow: 'border-l-amber-500',
  green: 'border-l-emerald-500',
} as const;

export function DiagnosticCard({ result }: { result: DiagnosticResponse }) {
  const { vehicle, overallStatus, summary, alerts, services, disclaimer } = result;
  return (
    <section
      aria-label="Resultado del diagnóstico"
      className={`space-y-5 rounded-2xl border-l-8 bg-white p-6 shadow-sm ring-1 ring-slate-200 ${STATUS_BORDER[overallStatus]}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {vehicle.make} {vehicle.model} {vehicle.year}
          </h2>
          <p className="text-sm text-slate-500">{vehicle.mileageKm.toLocaleString('es-CO')} km</p>
        </div>
        <div className="flex items-center gap-2 text-right">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 print:hidden"
          >
            <Printer aria-hidden="true" className="h-3.5 w-3.5" />
            Imprimir / PDF
          </button>
          <span className="sr-only">Estado general: </span>
          <UrgencyBadge urgency={overallStatus} large />
        </div>
      </header>

      <p className="rounded-lg bg-slate-50 p-3 text-sm">{summary}</p>

      {alerts.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <Activity aria-hidden="true" className="h-4 w-4 text-slate-500" /> Alertas
          </h3>
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <UrgencyBadge urgency={a.urgency} />
                  <span className="font-medium">{a.title}</span>
                  <span className="ml-auto text-xs text-slate-500">
                    {SOURCE_LABEL[a.source]}
                    {a.code ? ` · ${a.code}` : ''}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{a.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {services.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 font-semibold">
            <Wrench aria-hidden="true" className="h-4 w-4 text-slate-500" /> Servicios recomendados
          </h3>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {groupServices(services).map((entry) =>
              entry.kind === 'single' ? (
                <ServiceItem key={entry.service.id} service={entry.service} />
              ) : (
                <li key={`group-${entry.dueAtKm}`}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-3 hover:bg-slate-50">
                      <UrgencyBadge urgency={worstUrgency(entry.services.map((s) => s.urgency))} />
                      <span className="font-medium">Mantenimiento de los {entry.dueAtKm.toLocaleString('es-CO')} km</span>
                      <span className="text-sm text-slate-500">· {entry.services.length} tareas</span>
                      <ChevronDown aria-hidden="true" className="ml-auto h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                    </summary>
                    <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/50">
                      {entry.services.map((s) => (
                        <ServiceItem key={s.id} service={s} compact />
                      ))}
                    </ul>
                  </details>
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-400">{disclaimer}</p>
    </section>
  );
}

export function DiagnosticSkeleton() {
  return (
    <div role="status" aria-label="Cargando diagnóstico" className="animate-pulse space-y-4 rounded-2xl bg-white p-6 ring-1 ring-slate-200">
      <div className="h-5 w-1/2 rounded bg-slate-200" />
      <div className="h-12 rounded bg-slate-100" />
      <div className="h-16 rounded bg-slate-100" />
      <div className="h-16 rounded bg-slate-100" />
    </div>
  );
}
