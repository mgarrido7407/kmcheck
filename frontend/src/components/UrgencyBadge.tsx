import type { Urgency } from '@kmcheck/shared';
import { CircleCheck, OctagonAlert, TriangleAlert } from 'lucide-react';

/** Color + ícono + texto: la urgencia nunca depende solo del color (accesibilidad). */
export const URGENCY_META: Record<Urgency, { label: string; classes: string; Icon: typeof CircleCheck }> = {
  red: { label: 'Urgente', classes: 'bg-red-100 text-red-800 ring-red-300', Icon: OctagonAlert },
  yellow: { label: 'Pronto', classes: 'bg-amber-100 text-amber-800 ring-amber-300', Icon: TriangleAlert },
  green: { label: 'OK', classes: 'bg-emerald-100 text-emerald-800 ring-emerald-300', Icon: CircleCheck },
};

export function UrgencyBadge({ urgency, large = false }: { urgency: Urgency; large?: boolean }) {
  const { label, classes, Icon } = URGENCY_META[urgency];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ring-1 ${classes} ${
        large ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <Icon aria-hidden="true" className={large ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      {label}
    </span>
  );
}
