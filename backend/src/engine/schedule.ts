export interface ScheduleItem {
  id: string;
  name: string;
  intervalKm?: number;
  intervalYears?: number;
  reason: string;
}

/** Plan de mantenimiento preventivo genérico (vehículo de gasolina, uso normal). */
export const MAINTENANCE_SCHEDULE: ScheduleItem[] = [
  { id: 'oil-change', name: 'Cambio de aceite y filtro', intervalKm: 10_000, intervalYears: 1, reason: 'Lubricación del motor' },
  { id: 'tire-rotation', name: 'Rotación y balanceo de llantas', intervalKm: 10_000, reason: 'Desgaste uniforme de las llantas' },
  { id: 'air-filter', name: 'Filtro de aire del motor', intervalKm: 20_000, reason: 'Flujo de aire y consumo' },
  { id: 'cabin-filter', name: 'Filtro de aire de cabina', intervalKm: 20_000, reason: 'Calidad del aire interior' },
  { id: 'brake-fluid', name: 'Cambio de líquido de frenos', intervalKm: 40_000, intervalYears: 2, reason: 'El líquido absorbe humedad y pierde eficacia' },
  { id: 'spark-plugs', name: 'Cambio de bujías', intervalKm: 60_000, reason: 'Encendido eficiente y prevención de fallos de encendido' },
  { id: 'coolant', name: 'Cambio de refrigerante', intervalKm: 60_000, intervalYears: 5, reason: 'Prevención de sobrecalentamiento y corrosión' },
  { id: 'transmission-fluid', name: 'Cambio de aceite de transmisión', intervalKm: 60_000, reason: 'Protección de la caja de cambios' },
  { id: 'timing-belt', name: 'Kit de distribución (correa)', intervalKm: 100_000, reason: 'Una rotura puede destruir el motor' },
  { id: 'battery', name: 'Prueba / reemplazo de batería', intervalYears: 4, reason: 'Vida útil típica de 3 a 5 años' },
];

export function scheduleItem(id: string): ScheduleItem | undefined {
  return MAINTENANCE_SCHEDULE.find((s) => s.id === id);
}
