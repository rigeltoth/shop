export function maskKey(value: string): string {
    if (!value) return '—';
    if (value.length <= 12) return value;
    return `${value.slice(0, 7)}…${value.slice(-4)}`;
}

export function usageColor(pct: number): 'success' | 'warning' | 'danger' {
    if (pct >= 90) return 'danger';
    if (pct >= 70) return 'warning';
    return 'success';
}

export function usageBarClass(pct: number): string {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
}
