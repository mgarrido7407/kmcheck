import type { Urgency } from '../schemas/index.js';

export interface ObdEntry {
  title: string;
  detail: string;
  urgency: Urgency;
  /** Servicios del plan de mantenimiento relacionados con este código. */
  relatedServiceIds?: string[];
}

const misfire = (cyl: number | null): ObdEntry => ({
  title: cyl === null ? 'Fallo de encendido aleatorio / múltiple' : `Fallo de encendido en el cilindro ${cyl}`,
  detail:
    'El motor no está quemando el combustible correctamente. Revisar bujías, bobinas, inyectores y fugas de vacío. ' +
    'Conducir con fallos de encendido puede dañar el convertidor catalítico.',
  urgency: 'red',
  relatedServiceIds: ['spark-plugs'],
});

/** Base de conocimiento local de códigos OBD-II genéricos frecuentes. */
export const OBD_CODES: Record<string, ObdEntry> = {
  P0300: misfire(null),
  P0301: misfire(1),
  P0302: misfire(2),
  P0303: misfire(3),
  P0304: misfire(4),
  P0305: misfire(5),
  P0306: misfire(6),
  P0101: {
    title: 'Sensor MAF fuera de rango',
    detail: 'El medidor de flujo de aire reporta valores anormales. Suele deberse a suciedad o a un filtro de aire obstruido.',
    urgency: 'yellow',
    relatedServiceIds: ['air-filter'],
  },
  P0113: {
    title: 'Sensor de temperatura del aire de admisión (IAT): señal alta',
    detail: 'Posible sensor desconectado o defectuoso. Afecta la mezcla aire-combustible.',
    urgency: 'yellow',
  },
  P0128: {
    title: 'Temperatura del refrigerante por debajo de lo esperado',
    detail: 'Termostato probablemente atascado en posición abierta. Aumenta el consumo y el desgaste.',
    urgency: 'yellow',
    relatedServiceIds: ['coolant'],
  },
  P0171: {
    title: 'Mezcla pobre (banco 1)',
    detail: 'Exceso de aire o falta de combustible. Revisar fugas de vacío, sensor MAF y presión de combustible.',
    urgency: 'yellow',
    relatedServiceIds: ['air-filter'],
  },
  P0174: {
    title: 'Mezcla pobre (banco 2)',
    detail: 'Exceso de aire o falta de combustible. Revisar fugas de vacío, sensor MAF y presión de combustible.',
    urgency: 'yellow',
    relatedServiceIds: ['air-filter'],
  },
  P0217: {
    title: 'Sobrecalentamiento del motor',
    detail: 'Detén el vehículo. Conducir con el motor sobrecalentado puede dañar la junta de culata.',
    urgency: 'red',
    relatedServiceIds: ['coolant'],
  },
  P0335: {
    title: 'Sensor de posición del cigüeñal',
    detail: 'Puede provocar que el motor se apague o no arranque.',
    urgency: 'red',
  },
  P0420: {
    title: 'Eficiencia del catalizador por debajo del umbral (banco 1)',
    detail: 'El convertidor catalítico puede estar deteriorado. Verifica primero que no existan fallos de encendido.',
    urgency: 'yellow',
  },
  P0442: {
    title: 'Fuga pequeña en el sistema EVAP',
    detail: 'Comúnmente es la tapa de combustible mal cerrada. Bajo riesgo mecánico.',
    urgency: 'green',
  },
  P0455: {
    title: 'Fuga grande en el sistema EVAP',
    detail: 'Revisar la tapa de combustible y las mangueras del cánister.',
    urgency: 'yellow',
  },
  P0500: {
    title: 'Sensor de velocidad del vehículo',
    detail: 'Puede afectar el velocímetro, el ABS y los cambios de la transmisión.',
    urgency: 'yellow',
  },
  P0562: {
    title: 'Voltaje del sistema bajo',
    detail: 'Batería o alternador con problemas.',
    urgency: 'yellow',
    relatedServiceIds: ['battery'],
  },
  P0700: {
    title: 'Falla en el sistema de control de la transmisión',
    detail: 'El módulo de transmisión detectó una falla. Escanea el TCM para obtener el código específico.',
    urgency: 'red',
    relatedServiceIds: ['transmission-fluid'],
  },
  C0035: {
    title: 'Sensor de velocidad de la rueda delantera izquierda',
    detail: 'El ABS y el control de tracción pueden estar desactivados.',
    urgency: 'yellow',
  },
  U0100: {
    title: 'Pérdida de comunicación con el ECM/PCM',
    detail: 'Problema en la red CAN o en la alimentación del módulo del motor.',
    urgency: 'red',
  },
};

const SYSTEM_BY_PREFIX: Record<string, string> = {
  P: 'tren motriz (motor/transmisión)',
  C: 'chasis (frenos/suspensión/dirección)',
  B: 'carrocería (airbags/confort)',
  U: 'red de comunicación entre módulos',
};

/** Busca un código; si no existe en la base local, devuelve una entrada genérica por sistema. */
export function lookupObd(code: string): ObdEntry & { known: boolean } {
  const known = OBD_CODES[code];
  if (known) return { ...known, known: true };
  const system = SYSTEM_BY_PREFIX[code[0] ?? ''] ?? 'desconocido';
  const manufacturerSpecific = code[1] !== '0' && code[1] !== '2';
  return {
    known: false,
    title: `Código ${code}: sistema de ${system}`,
    detail: manufacturerSpecific
      ? 'Código específico del fabricante; no está en la base local. Consulta con un escáner o el manual del fabricante.'
      : 'Código genérico no catalogado en la base local. Se recomienda un escaneo profesional.',
    urgency: 'yellow',
  };
}
