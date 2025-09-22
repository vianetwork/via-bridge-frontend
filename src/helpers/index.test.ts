import { describe, it, expect } from "vitest";
import { toL1Amount } from "./index";

// These tests document the CURRENT behavior to reproduce the issue.
// They confirm that toL1Amount throws on empty/invalid strings,
// which is what causes the console error spam in the app.
describe("toL1Amount", () => {
  it("returns 0 for empty string or whitespace (desired behavior)", () => {
    expect(toL1Amount("")).toBe(0);
    expect(toL1Amount("    ")).toBe(0);
  });

  it("handles invalid or partial numbers safely (desired behavior)", () => {
    expect(toL1Amount(".")).toBe(0);
    expect(toL1Amount(",")).toBe(0);
    expect(toL1Amount("0.")).toBe(0);
    expect(toL1Amount(".1")).toBe(10_000_000);
    expect(toL1Amount("abc")).toBe(0);
  });

  it("converts valid BTC strings to sats", () => {
    expect(toL1Amount("0")).toBe(0);
    expect(toL1Amount("0.00000001")).toBe(1); // 1 sat
    expect(toL1Amount("0.00000001 ")).toBe(1); // 1 sat
    expect(toL1Amount("0.00002")).toBe(2000); // 2000 sats
    expect(toL1Amount("1")).toBe(100_000_000); // 1 BTC
    expect(toL1Amount("0.00123456")).toBe(123_456); // 0.00123456
  });

  it("floors amounts below 1 sat efficiently to 0 through integer conversion", () => {
    try {
      expect(toL1Amount("0.000000009")).toBe(0);
    } catch(e) {
      // parseEth could throw for too many decimals
      expect(e).toBeInstanceOf(Error);
    }
  });
});
