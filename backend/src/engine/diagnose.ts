import {
  compareUrgencyDesc,
  worstUrgency,
  type Alert,
  type DiagnosticResponse,
  type MaintenanceRequest,
  type Service,
  type Urgency,
} from '../schemas/index.js';
import { lookupObd } from './obdCodes.js';
import { MAINTENANCE_SCHEDULE, scheduleItem } from './schedule.js';
import { matchSymptoms } from './symptoms.js';

export const DISCLAIMER =
  'Diagnóstico orientativo generado automáticamente. No reemplaza la inspección de un mecánico certificado.';

const HIGH_MILEAGE_KM = 250_000;

const fmtKm = (km: number) => `${km.toLocaleString('es-CO')} km`;

/**
 * Motor de diagnóstico basado en reglas (sin IA).
 * Combina: plan de mantenimiento por km/antiguedad + base de codigos OBD-II + deteccion de sintomas,
 * y correlaciona hallazgos con servicios (ej. P0300 + bujías vencidas => urgente).
 */
export function diagnose(req: MaintenanceRequest, now: Date = new Date()): DiagnosticResponse {
  const alerts: Alert[] = [];
  const services = new Map<string, Service>();
  const km = req.mileageKm;
  const ageYears = Math.max(0, now.getFullYear() - req.year);

  const upsertService = (id: string, urgency: Urgency, reason: string, dueAtKm?: number) => {
    const existing = services.get(id);
    if (existing) {
      existing.urgency = worstUrgency([existing.urgency, urgency]);
      if (!existing.reason.includes(reason)) existing.reason = `${existing.reason}. ${reason}`;
      return;
    }
    const item = scheduleItem(id);
    services.set(id, {
      id,
      name: item?.name ?? id,
      reason,
      urgency,
      ...(dueAtKm !== undefined ? { dueAtKm } : {}),
    });
  };

  // 1) Plan de mantenimiento preventivo por kilometraje y antigüedad
  for (const item of MAINTENANCE_SCHEDULE) {
    if (item.intervalKm && km > 0) {
      const since = km % item.intervalKm;
      const dueNow = since === 0;
      const remaining = dueNow ? 0 : item.intervalKm - since;
      const window = Math.max(2000, item.intervalKm * 0.2);
      if (remaining <= window) {
        const urgent = remaining <= Math.max(1000, item.intervalKm * 0.1);
        upsertService(
          item.id,
          urgent ? 'yellow' : 'green',
          dueNow
            ? `${item.reason}: corresponde a los ${fmtKm(km)}`
            : `${item.reason}: próximo a los ${fmtKm(km + remaining)} (faltan ${fmtKm(remaining)})`,
          km + remaining,
        );
      }
    }
    if (item.intervalYears && ageYears >= item.intervalYears) {
      const byAgeOnly = !item.intervalKm;
      if (byAgeOnly || ageYears % item.intervalYears === 0) {
        upsertService(item.id, 'yellow', `${item.reason}: vence por antigüedad (${ageYears} años)`);
      }
    }
  }

  if (km >= HIGH_MILEAGE_KM) {
    alerts.push({
      id: 'high-mileage',
      title: 'Alto kilometraje',
      detail: `Con ${fmtKm(km)} se recomienda una inspección general de suspensión, soportes del motor y fugas.`,
      urgency: 'yellow',
      source: 'schedule',
    });
  }

  // 2) Códigos OBD-II
  for (const code of new Set(req.obdCodes)) {
    const entry = lookupObd(code);
    alerts.push({
      id: `obd-${code}`,
      title: entry.title,
      detail: entry.detail,
      urgency: entry.urgency,
      source: 'obd',
      code,
    });
    for (const sid of entry.relatedServiceIds ?? []) {
      upsertService(sid, entry.urgency, `Relacionado con el código ${code}`);
    }
  }

  // 3) Síntomas en texto libre
  if (req.symptoms) {
    const matches = matchSymptoms(req.symptoms);
    for (const rule of matches) {
      alerts.push({
        id: `symptom-${rule.id}`,
        title: rule.title,
        detail: rule.detail,
        urgency: rule.urgency,
        source: 'symptom',
      });
      for (const sid of rule.relatedServiceIds ?? []) {
        upsertService(sid, rule.urgency, `Relacionado con el síntoma: ${rule.title.toLowerCase()}`);
      }
    }
    if (matches.length === 0) {
      alerts.push({
        id: 'symptom-unrecognized',
        title: 'Síntomas no reconocidos',
        detail: 'No pudimos asociar la descripción a un patrón conocido. Describe ruidos, olores, luces o comportamiento con más detalle.',
        urgency: 'green',
        source: 'symptom',
      });
    }
  }

  const sortedAlerts = alerts.sort((a, b) => compareUrgencyDesc(a.urgency, b.urgency));
  const sortedServices = [...services.values()].sort(
    (a, b) => compareUrgencyDesc(a.urgency, b.urgency) || (a.dueAtKm ?? 0) - (b.dueAtKm ?? 0),
  );
  const overallStatus = worstUrgency([...sortedAlerts, ...sortedServices].map((x) => x.urgency));

  return {
    vehicle: { make: req.make, model: req.model, year: req.year, mileageKm: km },
    overallStatus,
    summary: buildSummary(overallStatus, sortedAlerts, sortedServices),
    alerts: sortedAlerts,
    services: sortedServices,
    generatedBy: 'rules-engine',
    generatedAt: now.toISOString(),
    disclaimer: DISCLAIMER,
  };
}

function buildSummary(status: Urgency, alerts: Alert[], services: Service[]): string {
  const reds = [...alerts, ...services].filter((x) => x.urgency === 'red').length;
  const yellows = [...alerts, ...services].filter((x) => x.urgency === 'yellow').length;
  if (status === 'red') {
    return `Atención inmediata: ${reds} hallazgo(s) crítico(s)${yellows ? ` y ${yellows} a programar pronto` : ''}. Evita viajes largos hasta revisarlo.`;
  }
  if (status === 'yellow') {
    return `Hay ${yellows} punto(s) que conviene atender pronto. El vehículo puede circular con precaución.`;
  }
  const next = services[0];
  return next
    ? `Sin alertas. Próximo servicio: ${next.name.toLowerCase()}.`
    : 'Sin alertas ni servicios próximos. Mantén el plan de mantenimiento al día.';
}
