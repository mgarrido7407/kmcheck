import { MIN_YEAR } from '@kmcheck/shared';

export interface VehicleMakeCatalog {
  make: string;
  models: readonly string[];
}

export const POPULAR_VEHICLES: readonly VehicleMakeCatalog[] = [
  { make: 'Toyota', models: ['Corolla', 'Hilux', 'Yaris', 'RAV4', 'Corolla Cross', 'Fortuner', 'Prado'] },
  { make: 'Chevrolet', models: ['Spark', 'Onix', 'Aveo', 'Tracker', 'Sail', 'Captiva', 'D-Max'] },
  { make: 'Mazda', models: ['2', '3', 'CX-3', 'CX-30', 'CX-5', 'CX-50', 'BT-50'] },
  { make: 'Renault', models: ['Logan', 'Sandero', 'Stepway', 'Duster', 'Kwid', 'Koleos', 'Oroch'] },
  { make: 'Kia', models: ['Picanto', 'Rio', 'Soluto', 'Cerato', 'Sportage', 'Seltos', 'Sorento'] },
  { make: 'Hyundai', models: ['i10', 'Accent', 'HB20', 'Elantra', 'Tucson', 'Creta', 'Santa Fe'] },
  { make: 'Nissan', models: ['March', 'Versa', 'Sentra', 'Kicks', 'Qashqai', 'X-Trail', 'Frontier'] },
  { make: 'Volkswagen', models: ['Gol', 'Polo', 'Virtus', 'Jetta', 'T-Cross', 'Taos', 'Tiguan'] },
  { make: 'Ford', models: ['Fiesta', 'Focus', 'Escape', 'Explorer', 'Ranger', 'F-150', 'Bronco Sport'] },
  { make: 'Honda', models: ['Civic', 'City', 'Accord', 'CR-V', 'HR-V', 'WR-V'] },
  { make: 'Suzuki', models: ['Swift', 'Baleno', 'Vitara', 'Jimny', 'S-Cross'] },
  { make: 'Mitsubishi', models: ['Mirage', 'Lancer', 'ASX', 'Outlander', 'Montero Sport', 'L200'] },
] as const;

export const POPULAR_MAKES: readonly string[] = POPULAR_VEHICLES.map((entry) => entry.make);

/** Devuelve los modelos populares para la marca indicada (coincidencia exacta sin importar mayúsculas). */
export function getModelsForMake(make: string): readonly string[] {
  const normalized = make.trim().toLowerCase();
  if (!normalized) return [];
  const found = POPULAR_VEHICLES.find((entry) => entry.make.toLowerCase() === normalized);
  return found ? found.models : [];
}

/** Genera la lista descendente de años válidos (desde el próximo año hasta MIN_YEAR). */
export function getYearOptions(currentYear = new Date().getFullYear()): number[] {
  const maxYear = currentYear + 1;
  const years: number[] = [];
  for (let y = maxYear; y >= MIN_YEAR; y -= 1) {
    years.push(y);
  }
  return years;
}

