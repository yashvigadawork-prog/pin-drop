export function ago(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (!isFinite(t)) return iso;
  const m = Math.max(0, Math.round((now - t) / 60000));
  if (m < 2) return "Just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}

export function daysSince(iso: string, now: number): number {
  const t = Date.parse(iso);
  return isFinite(t) ? Math.max(0, Math.floor((now - t) / 86400000)) : 0;
}

export function daysLeft(iso: string, now: number): number {
  const t = Date.parse(iso);
  return isFinite(t) ? Math.max(0, Math.ceil((t - now) / 86400000)) : 0;
}

export function addDays(from: number, days: number): string {
  return new Date(from + days * 86400000).toISOString();
}
