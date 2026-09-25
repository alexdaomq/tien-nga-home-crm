export function money(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(value || 0)) + "đ";
}

export function formatDate(value: string) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}

export function daysBetween(fromISO: string, toISO: string) {
  const from = new Date(fromISO + "T00:00:00Z").getTime();
  const to = new Date(toISO + "T00:00:00Z").getTime();
  return Math.round((to - from) / 86400000);
}

export function addDays(iso: string, days: number) {
  const base = iso ? new Date(iso + "T00:00:00Z") : new Date();
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function minutesBetween(fromTimestamp: string, toTimestamp: string) {
  const from = new Date(fromTimestamp.replace(" ", "T") + "Z").getTime();
  const to = new Date(toTimestamp.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.max(0, Math.round((to - from) / 60000));
}
