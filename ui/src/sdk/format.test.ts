import { describe, expect, it } from "vitest";
import { fmtDate, fmtHM, fmtIsoTime, fmtNum, fmtPct } from "./index";

describe("formatters (defaults: metric, 24 h, day-month)", () => {
  it("formats numbers without -0", () => { expect(fmtNum(-0.2)).toBe("0"); expect(fmtNum(12.6)).toBe("13"); expect(fmtNum(null)).toBe("--"); });
  it("formats percentages with sign", () => { expect(fmtPct(1.234)).toBe("+1.23%"); expect(fmtPct(-2)).toBe("-2.00%"); });
  it("uses 24-hour time", () => { expect(fmtHM(7, 5)).toBe("07:05"); expect(fmtIsoTime("2026-11-03T20:00")).toBe("20:00"); });
  it("formats dates day-month", () => { expect(fmtDate("2026-11-03")).toBe("Tue 3 Nov"); });
});
