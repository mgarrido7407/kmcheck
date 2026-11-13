import { MaintenanceRequestSchema, type MaintenanceRequest } from '@kmcheck/shared';
import { Car, LoaderCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';

interface Props {
  onSubmit: (data: MaintenanceRequest) => void;
  loading?: boolean;
  /** Errores por campo devueltos por el servidor (HTTP 400). */
  serverErrors?: Record<string, string>;
}

type Field = 'make' | 'model' | 'year' | 'mileageKm' | 'symptoms' | 'obdCodes';

const toNumber = (v: string) => (v.trim() === '' ? undefined : Number(v));
const topField = (path: string) => path.split('.')[0] ?? path;

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
          <input {...fieldProps('make')} placeholder="Toyota" autoComplete="off" />
          {errorFor('make')}
        </div>
        <div>
          <label htmlFor="model" className="text-sm font-medium">Modelo *</label>
          <input {...fieldProps('model')} placeholder="Corolla" autoComplete="off" />
          {errorFor('model')}
        </div>
        <div>
          <label htmlFor="year" className="text-sm font-medium">Año *</label>
          <input {...fieldProps('year')} type="number" inputMode="numeric" placeholder="2018" />
          {errorFor('year')}
        </div>
        <div>
          <label htmlFor="mileageKm" className="text-sm font-medium">Kilometraje actual *</label>
          <input {...fieldProps('mileageKm')} type="number" inputMode="numeric" placeholder="60000" />
          {errorFor('mileageKm')}
        </div>
      </div>

      <div>
        <label htmlFor="obdCodes" className="text-sm font-medium">Códigos OBD-II (opcional)</label>
        <input {...fieldProps('obdCodes')} placeholder="P0300, P0420" autoComplete="off" />
        {errorFor('obdCodes')}
      </div>

      <div>
        <label htmlFor="symptoms" className="text-sm font-medium">Síntomas (opcional)</label>
        <textarea {...fieldProps('symptoms')} rows={3} placeholder="Ej.: el motor tironea en ralentí y la luz de check engine está encendida" />
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
