import { formatUnits, parseUnits } from "ethers";

export interface ParsedTokenAmount {
  raw: string;
  normalized: string;
  baseUnits?: bigint;
  error?: string;
}

/**
 * Parses a user-entered token amount string into a structured result.
 * @param value - The raw input string (e.g., "1.5", "100", ".5")
 * @param decimals - The token's decimal places (e.g., 6 for USDC, 18 for ETH)
 * @returns Parsed result with normalized value and optional baseUnits/error
 */
export function parseTokenAmount(value: string, decimals: number): ParsedTokenAmount {
  const raw = value.trim();
  if (!raw) {
    return { raw, normalized: "" };
  }

  if (raw === ".") {
    return { raw, normalized: "", error: "Invalid amount" };
  }

  if (!/^\d*\.?\d*$/.test(raw)) {
    return { raw, normalized: "", error: "Invalid amount" };
  }

  const [, decPart] = raw.split(".");
  if (decPart && decPart.length > decimals) {
    return { raw, normalized: "", error: `Max ${decimals} decimals` };
  }

  const normalized = raw.endsWith(".") ? raw.slice(0, -1) : raw;
  if (!normalized) {
    return { raw, normalized: "" };
  }

  try {
    const baseUnits = parseUnits(normalized, decimals);
    return { raw, normalized, baseUnits };
  } catch {
    return { raw, normalized: "", error: "Invalid amount" };
  }
}

/**
 * Formats a numeric token amount to a display string with proper decimal handling.
 * @param value - The numeric amount (e.g., 1.5)
 * @param decimals - The token's decimal places
 * @returns Formatted string representation
 */
export function formatTokenAmount(value: number, decimals: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const baseUnits = parseUnits(safeValue.toFixed(decimals), decimals);
  return formatUnits(baseUnits, decimals);
}
