// src/utils/vault-conversion.ts
import type { BridgeMode } from "@/components/bridge/bridge-mode-tabs";

/** Result of a vault conversion */
export interface VaultConversionResult {
  /** The calculated output amount*/
  outputAmount: string;
  /** The rate used for calculation */
  displayRate: string;
  /** The input amount (formatted for display */
  inputAmount: string;
}

/**
 * Calculate the vault conversion between underlying asset and vault shares
 *
 * For yield vaults, converts between underlying asset and vault shares:
 * - Deposit: underlying (USDC) to vault shares (vUSDC)
 * - Withdraw: vault shares (vUSDC) to underlying (USDC)
 *
 * @param inputAmount - The amount being converted
 * @param exchangeRate - Raw exchange rate (assets per share) from API
 * @param mode - `deposit` (underlying to shares) or `withdraw` (shares to underlying)
 * @param decimals - Token decimals for formatting output
 * @returns Calculation result or null if inputs are invalid
 *
 * @example
 * ```ts
 * // Depositing 100 USDC with rate 0.98 (1 USDC = 0.98 vUSDC)
 * const result = calculateVaultConversion(100, "0.98", "deposit", 6);
 * // result = { outputAmount: "98.000000", displayRate: "0.980000", inputAmount: "100.000000" }
 *
 * // Withdrawing 100 vUSDC with rate 0.98 (1 vUSDC = 1.0204 USDC)
 * const result = calculateVaultConversion(100, "0.98", "withdraw", 6);
 * // result = { outputAmount: "102.040816", displayRate: "1.020408", inputAmount: "100.000000" }
 * ```
 */
export function calculateVaultConversion(inputAmount: number, exchangeRate: string, mode: BridgeMode, decimals: number): VaultConversionResult | null {
  if (!inputAmount || !exchangeRate) return null;

  try {
    const rate = parseFloat(exchangeRate);
    if (isNaN(rate) || rate === 0) return null;

    let outputAmount: number;
    let displayRate: string;

    if (mode === "deposit") {
      // Deposit: underlying (USDC) to vault shares (vUSDC)
      // User deposits USDC to the vault, receiving vUSDC at the exchange rate
      outputAmount = inputAmount * rate;
      displayRate = rate.toFixed(6);
    } else {
      // Withdraw: vault shares (vUSDC) to underlying (USDC)
      // User withdraws vUSDC from the vault, receiving USDC at the exchange rate
      outputAmount = inputAmount / rate;
      displayRate = (1 / rate).toFixed(6);
    }
    return { outputAmount: outputAmount.toFixed(decimals), displayRate, inputAmount: inputAmount.toFixed(decimals) };
  } catch (error) {
    console.error("Error calculating vault conversion:", error);
    return null;
  }
}

/**
 * Format vault exchange rate for display in the UI
 *
 * Shows the conversion rate between the underlying asset and vault shares:
 * - Deposit mode: "1 USDC = 0.9800 vUSDC"
 * - Withdraw mode: "1 vUSDC = 1.0204 USDC"
 *
 * @param exchangeRate - Raw exchange rate (assets per share) from API
 * @param underlyingSymbol - The underlying asset symbol (e.g., "USDC")
 * @param vaultShareSymbol - The vault share token (e.g., "vUSDC")
 * @param mode - `deposit` (underlying to shares) or `withdraw` (shares to underlying)
 * @returns Formatted display string or null if rate is invalid
 *
 * @example
 * ```ts
 * // Deposit mode - show how much vUSDC you get per USDC
 * formatVaultRate("0.98", "USDC", "vUSDC", "deposit");
 * // Returns: "1 USDC = 0.9800 vUSDC"
 *
 * // Withdraw mode - show how much USDC you get per vUSDC
 * formatVaultRate("0.98", "USDC", "vUSDC", "withdraw");
 * // Returns: "1 vUSDC = 1.0204 USDC"
 * ```
 */
export function formatVaultRate(exchangeRate: string | null, underlyingSymbol: string, vaultShareSymbol: string, mode: BridgeMode): string | null {
  if (!exchangeRate) return null;

  try {
    const rate = parseFloat(exchangeRate);
    if (isNaN(rate) || rate === 0) return null;

    // Deposit: Show "1 USDC = x vUSDC"
    // User wants to know how many vault shares they get per underlying asset
    if (mode === "deposit") return `1 ${underlyingSymbol} = ${rate.toFixed(4)} ${vaultShareSymbol}`;

    // Withdraw: Show "1 vUSDC = x USDC"
    // User wants to know how much underlying they get per vault share
    if (mode === "withdraw") return `1 ${vaultShareSymbol} = ${(1 / rate).toFixed(4)} ${underlyingSymbol}`;

    return null;
  } catch {
    return null;
  }
}
