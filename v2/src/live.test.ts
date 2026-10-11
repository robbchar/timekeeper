import { describe, expect, it } from "vitest";
import { liveTotals } from "./live";

const totals = { today: 100, thisWeek: 1000, thisMonth: 5000, lastMonth: 9000 };

describe("liveTotals", () => {
  it("adds live seconds to today, this week and this month when the running entry is today's", () => {
    expect(liveTotals(totals, 60, "2026-10-10", "2026-10-10")).toEqual({
      today: 160,
      thisWeek: 1060,
      thisMonth: 5060,
      lastMonth: 9000,
    });
  });

  it("leaves totals alone when the running entry is from an earlier day", () => {
    expect(liveTotals(totals, 60, "2026-09-30", "2026-10-01")).toBe(totals);
  });
});
