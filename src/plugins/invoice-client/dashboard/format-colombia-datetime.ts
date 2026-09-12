const COLOMBIA_TZ = 'America/Bogota';

/** Muestra fechas del panel de facturas siempre en hora Colombia (evita ver UTC como 2:14 a.m. del día siguiente). */
export function formatColombiaDateTime(value: string | Date | null | undefined): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-CO', {
    timeZone: COLOMBIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}
