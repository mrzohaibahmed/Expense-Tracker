import { describe, expect, it } from "vitest";
import { makeReportRange, comparisonText, todayInTimezone } from "../lib/reports/dates";

describe("report calendar periods", () => {
  it("uses the user's timezone when UTC and local dates differ", () => {
    const instant = new Date("2026-10-19T20:30:00.000Z");
    expect(todayInTimezone("Asia/Karachi", instant)).toBe("2026-10-20");
    expect(todayInTimezone("America/Los_Angeles", instant)).toBe("2026-10-19");
  });

  it("uses the configured week start and compares equivalent elapsed days", () => {
    const monday = makeReportRange("week", "2026-10-20", 1);
    expect([monday.start, monday.end, monday.previousStart, monday.previousEnd]).toEqual(["2026-10-19", "2026-10-20", "2026-10-12", "2026-10-13"]);
    expect(monday.partial).toBe(true);
    const sunday = makeReportRange("week", "2026-10-20", 0);
    expect([sunday.start, sunday.previousStart]).toEqual(["2026-10-18", "2026-10-11"]);
  });

  it("clamps the current month to today and labels a shorter previous month", () => {
    const range = makeReportRange("month", "2026-03-30", 1);
    expect([range.start, range.end, range.previousStart, range.previousEnd]).toEqual(["2026-03-01", "2026-03-30", "2026-02-01", "2026-02-28"]);
    expect(range.comparisonLabel).toContain("shorter");
  });

  it("compares custom date ranges immediately before the elapsed range", () => {
    const range = makeReportRange("custom", "2026-10-20", 1, undefined, "2026-10-01", "2026-10-31");
    expect([range.start, range.end, range.previousStart, range.previousEnd]).toEqual(["2026-10-01", "2026-10-20", "2026-09-11", "2026-09-30"]);
    expect(() => makeReportRange("custom", "2026-10-20", 1, undefined, "2026-02-30", "2026-03-01")).toThrow();
  });

  it("avoids misleading percentages when the previous total is zero", () => {
    expect(comparisonText("12550", "0")).toContain("No percentage comparison");
    expect(comparisonText("0", "0")).toContain("both periods are zero");
    expect(comparisonText("12550", "10000")).toContain("25.5% higher");
  });
});
