import { MaintenanceRequestSchema, type MaintenanceRequest } from '@kmcheck/shared';
import { Car, LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { getModelsForMake, getYearOptions, POPULAR_MAKES } from '../data/vehicleCatalog';

interface Props {
  onSubmit: (data: MaintenanceRequest) => void;
  loading?: boolean;
  /** Errores por campo devueltos por el servidor (HTTP 400). */
  serverErrors?: Record<string, string>;
}

type Field = 'make' | 'model' | 'year' | 'mileageKm' | 'symptoms' | 'obdCodes';

const toNumber = (v: string) => (v.trim() === '' ? undefined : Number(v));
const topField = (path: string) => path.split('.')[0] ?? path;

const QUICK_OBD_CODES = ['P0300', 'P0420', 'P0171', 'P0128', 'P0442', 'P0562'] as const;
const QUICK_SYMPTOMS = [
  'Tironea en ralentí',
  'Check engine encendido',
  'Se recalienta',
  'Frenos chillan',
  'Batería débil al encender',
] as const;

const YEAR_OPTIONS = getYearOptions();

export function VehicleForm({ onSubmit, loading = false, serverErrors = {} }: Props) {
  const [values, setValues] = useState<Record<Field, string>>({
    make: '',
    model: '',
    year: '',
    mileageKm: '',
    symptoms: '',
    obdCodes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: Field) => (e: { target: { value: string } }) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const popularModels = getModelsForMake(values.make);

  const selectMake = (make: string) => {
    setValues((v) => {
      const nextModels = getModelsForMake(make);
      const keepModel = nextModels.some((m) => m.toLowerCase() === v.model.trim().toLowerCase());
      return { ...v, make, model: keepModel ? v.model : '' };
    });
  };

  const selectModel = (model: string) => {
    setValues((v) => ({ ...v, model }));
  };

  const appendObdCode = (code: string) => {
    setValues((v) => {
      const current = v.obdCodes
        .split(/[\s,;]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);
      if (current.includes(code)) return v;
      return { ...v, obdCodes: [...current, code].join(', ') };
    });
  };

  const appendSymptom = (phrase: string) => {
    setValues((v) => {
      const current = v.symptoms.trim();
      if (current.toLowerCase().includes(phrase.toLowerCase())) return v;
      return { ...v, symptoms: current ? `${current}; ${phrase}` : phrase };
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const candidate = {
      make: values.make,
      model: values.model,
      year: toNumber(values.year),
      mileageKm: toNumber(values.mileageKm),
      symptoms: values.symptoms,
      obdCodes: values.obdCodes.split(/[\s,;]+/).filter(Boolean),
    };
    // Validación temprana con el MISMO contrato que usa el servidor (que vuelve a validar).
    const result = MaintenanceRequestSchema.safeParse(candidate);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = topField(issue.path.join('.'));
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(result.data);
  };

  const allErrors: Record<string, string> = {};
  for (const [k, msg] of Object.entries(serverErrors)) allErrors[topField(k)] ??= msg;
  Object.assign(allErrors, errors);

  const input =
    'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-200 aria-[invalid=true]:border-red-500';

  const fieldProps = (field: Field) => ({
    id: field,
    name: field,
    value: values[field],
    onChange: set(field),
    'aria-invalid': allErrors[field] ? true : undefined,
    'aria-describedby': allErrors[field] ? `${field}-error` : undefined,
    className: input,
  });

  const errorFor = (field: Field) =>
    allErrors[field] ? (
      <p id={`${field}-error`} role="alert" className="mt-1 text-xs text-red-600">
        {allErrors[field]}
      </p>
    ) : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Car aria-hidden="true" className="h-5 w-5 text-sky-600" /> Datos del vehículo
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="make" className="text-sm font-medium">Marca *</label>
          <input {...fieldProps('make')} list="popular-makes" placeholder="Toyota" autoComplete="off" />
          <datalist id="popular-makes">
            {POPULAR_MAKES.map((make) => (
              <option key={make} value={make} />
            ))}
          </datalist>
          {errorFor('make')}
        </div>
        <div>
          <label htmlFor="model" className="text-sm font-medium">Modelo *</label>
          <input
            {...fieldProps('model')}
            list="popular-models"
            placeholder={popularModels[0] ?? 'Corolla'}
            autoComplete="off"
          />
          <datalist id="popular-models">
            {popularModels.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
          {errorFor('model')}
        </div>
        <div>
          <label htmlFor="year" className="text-sm font-medium">Año *</label>
          <select {...fieldProps('year')}>
            <option value="">Selecciona un año</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
          {errorFor('year')}
        </div>
        <div>
          <label htmlFor="mileageKm" className="text-sm font-medium">Kilometraje actual *</label>
          <input {...fieldProps('mileageKm')} type="number" inputMode="numeric" placeholder="60000" />
          {errorFor('mileageKm')}
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3">
        <div>
          <p className="text-xs font-medium text-slate-600">Marcas populares</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {POPULAR_MAKES.map((make) => {
              const selected = values.make.trim().toLowerCase() === make.toLowerCase();
              return (
                <button
                  key={make}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectMake(make)}
                  className={
                    selected
                      ? 'rounded-md border border-sky-500 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 shadow-xs'
                      : 'rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700'
                  }
                >
                  {make}
                </button>
              );
            })}
          </div>
        </div>

        {popularModels.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-600">Modelos populares de {values.make.trim()}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {popularModels.map((model) => {
                const selected = values.model.trim().toLowerCase() === model.toLowerCase();
                return (
                  <button
                    key={model}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectModel(model)}
                    className={
                      selected
                        ? 'rounded-md border border-sky-500 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 shadow-xs'
                        : 'rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700'
                    }
                  >
                    {model}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="obdCodes" className="text-sm font-medium">Códigos OBD-II (opcional)</label>
        <input {...fieldProps('obdCodes')} placeholder="P0300, P0420" autoComplete="off" />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {QUICK_OBD_CODES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => appendObdCode(code)}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
            >
              + {code}
            </button>
          ))}
        </div>
        {errorFor('obdCodes')}
      </div>

      <div>
        <label htmlFor="symptoms" className="text-sm font-medium">Síntomas (opcional)</label>
        <textarea {...fieldProps('symptoms')} rows={3} placeholder="Ej.: el motor tironea en ralentí y la luz de check engine está encendida" />
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {QUICK_SYMPTOMS.map((symptom) => (
            <button
              key={symptom}
              type="button"
              onClick={() => appendSymptom(symptom)}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
            >
              + {symptom}
            </button>
          ))}
        </div>
        {errorFor('symptoms')}
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
        {loading ? 'Analizando...' : 'Revisar mantenimiento'}
      </button>
    </form>
  );
}
