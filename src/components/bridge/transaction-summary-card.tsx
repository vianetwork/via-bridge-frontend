// src/components/bridge/transaction-summary-card.tsx
"use client";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

export type TransactionFeeKind = "networkGas" | "viaVerifier";

interface TransactionSummaryCardProps {
  /** Transfer amount as string (e.g., "0.00064965") */
  amount: string;
  /** Network fee as string (e.g., "100 sats") */
  fee: string;
  /** Fee category used to render helper copy under the fee label */
  feeKind?: TransactionFeeKind;
  /** Net amount to receive as string (e.g., "0.00064865") */
  netReceive: string;
  /** Unit to display for transfer amount (e.g, "BTC", "USDC", "vUSDC" */
  unit: string;
  /** Unit to display for net receive (e.g, "BTC", "USDC"). If not provided, uses unit */
  netReceiveUnit?: string;
  /** Show conversion calculation (e.g., "X vUSDC × Y = Z USDC") */
  showConversion?: boolean;
  /** Conversion rate (calculated from amounts if not provided) */
  conversionRate?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Transaction Summary Card
 *
 * Display a breakdown of the transaction
 * - Transfer amount
 * - Network fee
 * - Net amount to receive (highlighted)
 *
 * @example
 * ```tsx
 * <TransactionSummaryCard amount="0.00064965" fee={100} netReceive={0.00064865} unit="BTC" />
 * ```
 */
export function TransactionSummaryCard({amount, fee, feeKind = "viaVerifier", netReceive, unit, netReceiveUnit, showConversion, conversionRate, className} : TransactionSummaryCardProps) {
  const receiveUnit = netReceiveUnit || unit;
  const feeDescription = feeKind === "networkGas" ? "Estimated gas fee for the network transaction" : "Required for processing on the Via Verifier Network";
  
  // Calculate conversion rate if not provided but conversion should be shown
  const calculatedRate = useMemo(() => {
    if (conversionRate) return conversionRate;
    if (showConversion) {
      try {
        const fromAmount = parseFloat(amount);
        const toAmount = parseFloat(netReceive);
        if (fromAmount > 0 && toAmount > 0) {
          return (toAmount / fromAmount).toFixed(6);
        }
      } catch (error) {
        console.error("Error calculating conversion rate:", error);
      }
    }
    return null;
  }, [amount, netReceive, conversionRate, showConversion]);

  return (
    <div className={cn("border border-slate-200 rounded-md", className)}>
      {/*Header*/}
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
        <h3 className="text-sm font-semibold text-slate-900">
          Transaction Summary
        </h3>
      </div>

      {/*Rows*/}
      <div className="divide-y divide-slate-200">
        {/*Transfer Amount*/}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-900">
              Transfer Amount
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Total amount being transferred
            </div>
          </div>
          <div className="text-base font-semibold text-slate-900 tabular-nums">
            {amount} {unit}
          </div>
        </div>

        {/*Network Fee*/}
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-900">
              Network fee
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{feeDescription}</div>
          </div>
          <div className="text-base font-semibold text-slate-900 tabular-nums">
            {fee}
          </div>
        </div>

        {/*You will receive*/}
        <div className="px-5 py-4 flex items-center justify-between bg-green-50">
          <div>
            <div className="text-sm font-semibold text-green-900">
              You Will Receive
            </div>
            <div className="text-xs text-green-700 mt-0.5">Amount credited to destination address</div>
          </div>
          <div className="text-lg font-bold text-green-900 tabular-nums">{netReceive} {receiveUnit}</div>
        </div>

        {/* Conversion Calculation */}
        {showConversion && calculatedRate && (
          <div className="px-5 py-3 bg-blue-50 border-t border-blue-200">
            <div className="text-xs text-muted-foreground mb-1.5 font-medium">Conversion Calculation:</div>
            <div className="flex items-center gap-1.5 text-sm text-slate-700">
              <span className="font-semibold">{amount} {unit}</span>
              <span>×</span>
              <span className="font-semibold">{calculatedRate}</span>
              <span>=</span>
              <span className="font-bold text-blue-700">{netReceive} {receiveUnit}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
