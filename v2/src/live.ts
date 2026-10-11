import type { Totals } from "./api";

/**
 * Folds seconds the running timer added since the last fetch into the totals.
 * The backend buckets by the entry's day, so only a running entry dated today
 * counts; today sits inside this week and this month.
 */
export function liveTotals(totals: Totals, addSeconds: number, runningDay: string, today: string): Totals {
  if (runningDay !== today || addSeconds <= 0) return totals;
  return {
    ...totals,
    today: totals.today + addSeconds,
    thisWeek: totals.thisWeek + addSeconds,
    thisMonth: totals.thisMonth + addSeconds,
  };
}
