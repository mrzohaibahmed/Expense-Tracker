import { describe, expect, it } from "vitest";
import { amountInputValue, formatMinor, parseAmount, parseOpeningBalance, sumMinor } from "../lib/finance/money";

describe("exact PKR minor-unit calculations", () => {
  it("parses decimal amounts without floating-point rounding", () => {
    expect(parseAmount("1250.50")).toBe(125050);
    expect(parseAmount("0.01")).toBe(1);
    expect(parseAmount("90071992547409.91")).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("rejects invalid, zero, negative, and unsafe transaction amounts", () => {
    for (const input of ["0", "-1.00", "1.999", "1e3", "90071992547409.92", "", "01.00"]) {
      expect(() => parseAmount(input)).toThrow();
    }
  });

  it("supports signed opening balances and exact display", () => {
    expect(parseOpeningBalance("-42.07")).toBe(-4207);
    expect(parseOpeningBalance("0.00")).toBe(0);
    expect(amountInputValue(-4207)).toBe("-42.07");
    expect(formatMinor(-4207)).toBe("−Rs 42.07");
  });

  it("sums balances beyond the JavaScript safe integer range", () => {
    expect(sumMinor(["9007199254740991", "9007199254740991"])).toBe(18014398509481982n);
    expect(formatMinor(18014398509481982n)).toContain(".82");
  });
});
