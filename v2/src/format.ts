// Formatting for display and for the copy buttons. Copy formats are
// user-adjustable because every client system wants something different.

export type DurationFormat = "hms" | "hm" | "decimal";
export type DateFormat = "iso" | "us" | "long";

export const DURATION_FORMATS: Record<DurationFormat, string> = {
  hms: "hh:mm:ss  (02:15:30)",
  hm: "h:mm  (2:15)",
  decimal: "Decimal hours  (2.26)",
};

export const DATE_FORMATS: Record<DateFormat, string> = {
  iso: "2026-10-09",
  us: "10/09/2026",
  long: "Oct 9, 2026",
};

const pad = (n: number) => String(n).padStart(2, "0");

export function formatDuration(seconds: number, format: DurationFormat): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  switch (format) {
    case "hms":
      return `${pad(h)}:${pad(m)}:${pad(sec)}`;
    case "hm":
      return `${h}:${pad(m)}`;
    case "decimal":
      return (s / 3600).toFixed(2);
  }
}

/** Compact display form: "4h 05m", "35m", "0m". */
export function formatShort(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${pad(m)}m` : `${m}m`;
}

/** Running clock: "1:23:45". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(day: string, format: DateFormat): string {
  const date = parseDay(day);
  switch (format) {
    case "iso":
      return day;
    case "us":
      return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`;
    case "long":
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
}

/** Heading for a day group: "Today", "Yesterday", "Wed, Oct 7". */
export function dayHeading(day: string, today: string): string {
  if (day === today) return "Today";
  const diff = Math.round((parseDay(today).getTime() - parseDay(day).getTime()) / 86_400_000);
  if (diff === 1) return "Yesterday";
  const date = parseDay(day);
  const sameYear = date.getFullYear() === parseDay(today).getFullYear();
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function localDay(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return localDay(d);
}
