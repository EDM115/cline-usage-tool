import { describe, expect, test } from "bun:test";

import { splitDateRange } from "../src/date-windows";

describe("splitDateRange", () => {
  test("keeps every inclusive API window at or below 31 days without gaps", () => {
    expect(splitDateRange("2026-07-31", "2026-09-02")).toEqual([
      { startDate: "2026-07-31", endDate: "2026-08-30" },
      { startDate: "2026-08-31", endDate: "2026-09-02" },
    ]);
  });

  test("returns one window for a one-day account history", () => {
    expect(splitDateRange("2026-08-02", "2026-08-02")).toEqual([
      { startDate: "2026-08-02", endDate: "2026-08-02" },
    ]);
  });

  test("rejects an inverted range", () => {
    expect(() => splitDateRange("2026-08-03", "2026-08-02")).toThrow(
      "Start date must not be after end date",
    );
  });
});
