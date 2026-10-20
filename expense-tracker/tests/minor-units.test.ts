import { describe, expect, it } from "vitest";
import {
  MAX_SAFE_MONEY_MINOR,
  minorUnitsFromDatabase,
  minorUnitsToDatabase,
  positiveMinorUnits,
} from "../lib/money/minor-units";

describe("minor-unit serialization", () => {
  it("round-trips safe integer values without floating-point conversion", () => {
    const value = minorUnitsFromDatabase(MAX_SAFE_MONEY_MINOR);
    expect(minorUnitsToDatabase(value)).toBe(MAX_SAFE_MONEY_MINOR);
  });

  it("rejects fractional and unsafe database values", () => {
    expect(() => minorUnitsFromDatabase(1.5)).toThrow(RangeError);
    expect(() => minorUnitsFromDatabase(MAX_SAFE_MONEY_MINOR + 1)).toThrow(RangeError);
  });

  it("requires positive amounts for transactions and transfers", () => {
    expect(positiveMinorUnits(1)).toBe(1);
    expect(() => positiveMinorUnits(0)).toThrow(RangeError);
    expect(() => positiveMinorUnits(-1)).toThrow(RangeError);
  });
});
