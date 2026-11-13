import { z } from 'zod';

/**
 * Contrato de datos compartido entre frontend (React) y backend (Express).
 * Regla del proyecto: cualquier cambio en la API empieza aquí.
 */

export const MIN_YEAR = 1950;
export const MAX_MILEAGE_KM = 2_000_000;
export const MAX_SYMPTOMS_LENGTH = 1000;
export const MAX_OBD_CODES = 10;

/** Código OBD-II genérico: P/C/B/U + 4 caracteres hex (ej. P0300, U0100). */
export const OBD_CODE_REGEX = /^[PCBU][0-3][0-9A-F]{3}$/;

export const ObdCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(OBD_CODE_REGEX, { error: 'Código OBD-II inválido (formato esperado: P0300)' });

export const MaintenanceRequestSchema = z.object({
  make: z.string().trim().min(1, { error: 'La marca es obligatoria' }).max(50),
  model: z.string().trim().min(1, { error: 'El modelo es obligatorio' }).max(50),
  year: z
    .number({ error: 'El año debe ser un número' })
    .int({ error: 'El año debe ser un número entero' })
    .min(MIN_YEAR, { error: `El año debe ser mayor o igual a ${MIN_YEAR}` })
    .refine((y) => y <= new Date().getFullYear() + 1, { error: 'El año no puede estar en el futuro' }),
  mileageKm: z
    .number({ error: 'El kilometraje debe ser un número' })
    .int({ error: 'El kilometraje debe ser un número entero' })
    .min(0, { error: 'El kilometraje no puede ser negativo' })
    .max(MAX_MILEAGE_KM, { error: 'Kilometraje fuera de rango' }),
  symptoms: z.string().trim().max(MAX_SYMPTOMS_LENGTH).optional().default(''),
  obdCodes: z
    .array(ObdCodeSchema)
    .max(MAX_OBD_CODES, { error: `Máximo ${MAX_OBD_CODES} códigos OBD-II` })
    .optional()
    .default([]),
});

export type MaintenanceRequestInput = z.input<typeof MaintenanceRequestSchema>;
export type MaintenanceRequest = z.output<typeof MaintenanceRequestSchema>;

export const UrgencySchema = z.enum(['red', 'yellow', 'green']);
export type Urgency = z.infer<typeof UrgencySchema>;

export const AlertSchema = z.object({
  id: z.string(),
  title: z.string(),
  detail: z.string(),
  urgency: UrgencySchema,
  source: z.enum(['obd', 'symptom', 'schedule']),
  code: z.string().optional(),
});
export type Alert = z.infer<typeof AlertSchema>;

export const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  reason: z.string(),
  urgency: UrgencySchema,
  /** Kilometraje en que vence (o vencio) el servicio, si aplica. */
  dueAtKm: z.number().int().optional(),
});
export type Service = z.infer<typeof ServiceSchema>;

export const DiagnosticResponseSchema = z.object({
  vehicle: z.object({
    make: z.string(),
    model: z.string(),
    year: z.number().int(),
    mileageKm: z.number().int(),
  }),
  overallStatus: UrgencySchema,
  summary: z.string(),
  alerts: z.array(AlertSchema),
  services: z.array(ServiceSchema),
  generatedBy: z.enum(['rules-engine', 'claude']),
  generatedAt: z.string(),
  disclaimer: z.string(),
});
export type DiagnosticResponse = z.infer<typeof DiagnosticResponseSchema>;

export const ApiErrorSchema = z.object({
  error: z.string(),
  details: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

const URGENCY_RANK: Record<Urgency, number> = { green: 0, yellow: 1, red: 2 };

/** Devuelve la urgencia mas alta de una lista (green si esta vacia). */
export function worstUrgency(levels: Urgency[]): Urgency {
  return levels.reduce<Urgency>((acc, u) => (URGENCY_RANK[u] > URGENCY_RANK[acc] ? u : acc), 'green');
}

export function compareUrgencyDesc(a: Urgency, b: Urgency): number {
  return URGENCY_RANK[b] - URGENCY_RANK[a];
}
