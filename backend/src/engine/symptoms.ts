import type { Urgency } from '../schemas/index.js';

export interface SymptomRule {
  id: string;
  /**
   * Palabras o frases clave, SIN tildes y en minúsculas (el texto del usuario se normaliza
   * antes de comparar). Basta con que una coincida.
   */
  keywords: string[];
  title: string;
  detail: string;
  urgency: Urgency;
  relatedServiceIds?: string[];
}

export const SYMPTOM_RULES: SymptomRule[] = [
  {
    id: 'brakes-noise',
    keywords: ['chirrido al frenar', 'rechina al frenar', 'ruido al frenar', 'frenos rechinan', 'chillido', 'frenos suenan'],
    title: 'Ruido en los frenos',
    detail: 'Posible desgaste de las pastillas. Revisa pastillas y discos lo antes posible.',
    urgency: 'yellow',
  },
  {
    id: 'brakes-soft',
    keywords: ['pedal esponjoso', 'pedal blando', 'pedal se hunde', 'no frena', 'frena poco', 'frenos fallan'],
    title: 'Pérdida de eficacia de frenado',
    detail: 'Posible aire o fuga en el sistema hidráulico. No conduzcas hasta revisarlo.',
    urgency: 'red',
    relatedServiceIds: ['brake-fluid'],
  },
  {
    id: 'overheating',
    keywords: ['se calienta', 'sobrecalienta', 'temperatura alta', 'aguja de temperatura', 'vapor del capo', 'hierve'],
    title: 'Sobrecalentamiento',
    detail: 'Apaga el motor. Revisa el nivel de refrigerante, el termostato, el ventilador y la bomba de agua.',
    urgency: 'red',
    relatedServiceIds: ['coolant'],
  },
  {
    id: 'white-smoke',
    keywords: ['humo blanco'],
    title: 'Humo blanco persistente',
    detail: 'Puede indicar que se está quemando refrigerante (junta de culata). Revisión urgente.',
    urgency: 'red',
    relatedServiceIds: ['coolant'],
  },
  {
    id: 'blue-smoke',
    keywords: ['humo azul', 'quema aceite', 'consume aceite'],
    title: 'Consumo de aceite',
    detail: 'Posible desgaste de anillos o sellos de válvula. Vigila el nivel de aceite con frecuencia.',
    urgency: 'yellow',
    relatedServiceIds: ['oil-change'],
  },
  {
    id: 'black-smoke',
    keywords: ['humo negro'],
    title: 'Mezcla rica (humo negro)',
    detail: 'Exceso de combustible. Revisa el filtro de aire, los inyectores y los sensores.',
    urgency: 'yellow',
    relatedServiceIds: ['air-filter'],
  },
  {
    id: 'rough-idle',
    keywords: ['tironea', 'jalonea', 'tiembla en ralenti', 'ralenti inestable', 'falla el motor', 'se ahoga', 'cascabelea', 'pierde potencia'],
    title: 'Funcionamiento irregular del motor',
    detail: 'Síntomas compatibles con fallos de encendido o problemas de mezcla.',
    urgency: 'yellow',
    relatedServiceIds: ['spark-plugs', 'air-filter'],
  },
  {
    id: 'hard-start',
    keywords: ['no arranca', 'cuesta arrancar', 'arranque dificil', 'tarda en arrancar', 'bateria descargada', 'se descarga'],
    title: 'Dificultad de arranque',
    detail: 'Revisa la batería, los bornes, el alternador y el motor de arranque.',
    urgency: 'yellow',
    relatedServiceIds: ['battery'],
  },
  {
    id: 'vibration',
    keywords: ['vibra', 'vibracion', 'volante tiembla'],
    title: 'Vibraciones',
    detail: 'Posible desbalanceo de llantas, discos alabeados o soportes del motor.',
    urgency: 'yellow',
    relatedServiceIds: ['tire-rotation'],
  },
  {
    id: 'pulls',
    keywords: ['se va de lado', 'jala hacia', 'tira hacia', 'se desvia'],
    title: 'El vehículo se desvía',
    detail: 'Revisa la alineación, la presión de las llantas y los frenos.',
    urgency: 'yellow',
    relatedServiceIds: ['tire-rotation'],
  },
  {
    id: 'transmission-slip',
    keywords: ['patina la transmision', 'cambios bruscos', 'no entran los cambios', 'caja patina', 'golpea al cambiar'],
    title: 'Problemas de transmisión',
    detail: 'Revisa el nivel y el estado del aceite de transmisión y escanea el TCM.',
    urgency: 'red',
    relatedServiceIds: ['transmission-fluid'],
  },
  {
    id: 'fuel-smell',
    keywords: ['olor a gasolina', 'olor a combustible'],
    title: 'Olor a combustible',
    detail: 'Posible fuga de combustible: riesgo de incendio. Revísalo de inmediato.',
    urgency: 'red',
  },
  {
    id: 'check-engine',
    keywords: ['check engine', 'luz del motor', 'testigo del motor', 'mil encendida'],
    title: 'Luz de Check Engine encendida',
    detail: 'Escanea con un lector OBD-II para obtener el código de falla.',
    urgency: 'yellow',
  },
];

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchSymptoms(text: string): SymptomRule[] {
  const norm = normalizeText(text);
  if (!norm) return [];
  return SYMPTOM_RULES.filter((r) => r.keywords.some((k) => norm.includes(k)));
}
