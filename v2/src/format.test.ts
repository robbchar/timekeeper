import { describe, expect, it } from "vitest";
import {
  addDays,
  dayHeading,
  formatClock,
  formatDate,
  formatDuration,
  formatShort,
  localDay,
  parseDuration,
  parseDurationFormat,
  roundSeconds,
} from "./format";

describe("formatDuration", () => {
  it.each([
    ["hms", "02:15:30"],
    ["hm", "2:15"],
    ["decimal", "2.26"],
    ["hm_units", "2h 15m"],
  ] as const)("formats 2h 15m 30s as %s", (format, expected) => {
    expect(formatDuration(8130, format)).toBe(expected);
  });

  it.each([
    ["hms", "00:00:00"],
    ["hm", "0:00"],
    ["decimal", "0.00"],
    ["hm_units", "0h 00m"],
  ] as const)("formats 0 as %s", (format, expected) => {
    expect(formatDuration(0, format)).toBe(expected);
  });

  it("rounds fractional seconds to the nearest second", () => {
    expect(formatDuration(59.5, "hms")).toBe("00:01:00");
    expect(formatDuration(59.4, "hms")).toBe("00:00:59");
  });

  it("drops leftover seconds in h:mm", () => {
    expect(formatDuration(8159, "hm")).toBe("2:15");
  });

  it("drops leftover seconds in FreshBooks form", () => {
    expect(formatDuration(8159, "hm_units")).toBe("2h 15m");
  });

  it("keeps zero hours in FreshBooks form", () => {
    expect(formatDuration(35 * 60, "hm_units")).toBe("0h 35m");
  });

  it("rounds decimal hours to two places", () => {
    expect(formatDuration(30, "decimal")).toBe("0.01");
    expect(formatDuration(8100, "decimal")).toBe("2.25");
  });

  it("does not wrap past 24 hours", () => {
    expect(formatDuration(100 * 3600, "hms")).toBe("100:00:00");
    expect(formatDuration(100 * 3600, "hm")).toBe("100:00");
    expect(formatDuration(100 * 3600, "hm_units")).toBe("100h 00m");
  });

  it("clamps negative durations to zero", () => {
    expect(formatDuration(-5, "hms")).toBe("00:00:00");
  });
});

describe("parseDurationFormat", () => {
  it("keeps a known format", () => {
    expect(parseDurationFormat("hm_units")).toBe("hm_units");
  });

  it.each([undefined, "weekly", "toString"])("falls back to hh:mm:ss for %s", (value) => {
    expect(parseDurationFormat(value)).toBe("hms");
  });
});

describe("roundSeconds", () => {
  const exact = 12 * 60 + 34;

  it.each([
    ["up", 15, 15 * 60],
    ["nearest", 15, 15 * 60],
    ["down", 15, 0],
    ["up", 6, 18 * 60],
    ["nearest", 6, 12 * 60],
    ["down", 6, 12 * 60],
    ["up", 60, 3600],
    ["nearest", 60, 0],
  ] as const)("rounds 12:34 %s to %i minutes", (mode, step, expected) => {
    expect(roundSeconds(exact, step, mode)).toBe(expected);
  });

  it("leaves the value alone when rounding is off", () => {
    expect(roundSeconds(exact, null, "up")).toBe(exact);
  });

  it("leaves exact multiples alone in every mode", () => {
    for (const mode of ["up", "nearest", "down"] as const) {
      expect(roundSeconds(30 * 60, 15, mode)).toBe(30 * 60);
    }
  });

  it("rounds an exact half up when rounding to nearest", () => {
    expect(roundSeconds(7 * 60 + 30, 15, "nearest")).toBe(15 * 60);
    expect(roundSeconds(7 * 60 + 29, 15, "nearest")).toBe(0);
  });

  it("keeps zero at zero when rounding up", () => {
    expect(roundSeconds(0, 15, "up")).toBe(0);
  });

  it("works in whole seconds, so a live fraction doesn't bump up a step", () => {
    expect(roundSeconds(900.3, 15, "up")).toBe(900);
    expect(roundSeconds(900.3, null, "up")).toBe(900);
  });

  it("clamps negative durations to zero", () => {
    expect(roundSeconds(-5, 15, "up")).toBe(0);
  });
});

describe("parseDuration", () => {
  it.each([
    ["2:15", 8100],
    ["2:15:30", 8130],
    ["0:00", 0],
    ["24:00", 86400],
    [" 1:02:03 ", 3723],
  ])("parses %j as %s seconds", (text, expected) => {
    expect(parseDuration(text)).toBe(expected);
  });

  it.each([
    "",
    "2",
    "2:5",
    "2:60",
    "1:00:60",
    "1.5",
    "-1:00",
    "1:00:00:00",
    "a:bc",
    "24:00:01",
    "100:05",
    "99999999999999:00",
  ])("rejects %j", (text) => {
    expect(parseDuration(text)).toBeNull();
  });
});

describe("formatShort", () => {
  it.each([
    [0, "0m"],
    [2100, "35m"],
    [14700, "4h 05m"],
    [59.6, "1m"],
    [-60, "0m"],
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatShort(seconds)).toBe(expected);
  });
});

describe("formatClock", () => {
  it.each([
    [0, "0:00:00"],
    [5025, "1:23:45"],
    [59.9, "0:00:59"],
    [-1, "0:00:00"],
  ])("formats %s seconds as %s", (seconds, expected) => {
    expect(formatClock(seconds)).toBe(expected);
  });
});

describe("formatDate", () => {
  it.each([
    ["iso", "2026-10-09"],
    ["us", "10/09/2026"],
    ["long", "Oct 9, 2026"],
  ] as const)("formats as %s", (format, expected) => {
    expect(formatDate("2026-10-09", format)).toBe(expected);
  });

  it("zero-pads month and day in US format", () => {
    expect(formatDate("2026-01-05", "us")).toBe("01/05/2026");
  });
});

describe("dayHeading", () => {
  const today = "2026-10-11";

  it("labels today", () => {
    expect(dayHeading(today, today)).toBe("Today");
  });

  it("labels yesterday", () => {
    expect(dayHeading("2026-10-10", today)).toBe("Yesterday");
  });

  it("labels yesterday across a year boundary", () => {
    expect(dayHeading("2025-12-31", "2026-01-01")).toBe("Yesterday");
  });

  it("labels yesterday across a DST change", () => {
    expect(dayHeading("2026-03-08", "2026-03-09")).toBe("Yesterday");
    expect(dayHeading("2026-11-01", "2026-11-02")).toBe("Yesterday");
  });

  it("uses weekday and date for older days this year", () => {
    expect(dayHeading("2026-10-07", today)).toBe("Wed, Oct 7");
  });

  it("adds the year for days in another year", () => {
    expect(dayHeading("2025-12-30", "2026-01-01")).toBe("Tue, Dec 30, 2025");
  });
});

describe("addDays", () => {
  it.each([
    ["2026-10-11", 0, "2026-10-11"],
    ["2026-01-31", 1, "2026-02-01"],
    ["2026-03-01", -1, "2026-02-28"],
    ["2028-02-28", 1, "2028-02-29"],
    ["2026-12-31", 1, "2027-01-01"],
    ["2026-01-01", -1, "2025-12-31"],
    ["2026-10-11", -29, "2026-09-12"],
    ["2026-03-07", 2, "2026-03-09"],
  ])("%s plus %i days is %s", (day, n, expected) => {
    expect(addDays(day, n)).toBe(expected);
  });
});

describe("localDay", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});

describe("test time zone", () => {
  it("has a DST change, so the DST cases above are meaningful", () => {
    expect(new Date(2026, 2, 9).getTimezoneOffset()).not.toBe(
      new Date(2026, 2, 7).getTimezoneOffset(),
    );
  });
});
