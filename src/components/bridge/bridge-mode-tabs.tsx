// src/components/bridge/bridge-mode-tabs.tsx
"use client";

import { cn } from "@/lib/utils";

/**
 *  Bridge Mode Tabs
 *  A pill-style switch for toggling between deposit and withdrawal modes
 *
 *  @example
 *  ```tsx
 *  <BridgeModeTabs mode={mode} onModeChange={setmode} />
 *  ```
 */

export type BridgeMode = "deposit" | "withdraw";

interface BridgeModeTabsProps {
  mode: BridgeMode;
  onModeChange: (mode: BridgeMode) => void;
  className?: string;
  withdrawBadgeCount?: number; // Optional badge count for withdraw tab
  onWithdrawBadgeClick?: () => void; // Optional click handler for badge
}

export function BridgeModeTabs({ mode, onModeChange, className, withdrawBadgeCount, onWithdrawBadgeClick }: BridgeModeTabsProps) {
  return (
    <div className={cn("flex justify-center mb-6", className)}>
      <div className="bg-slate-100 rounded-2xl p-1.5 inline-flex gap-1 w-full max-w-md">
        <button type="button" onClick={() => onModeChange("deposit")}
                className={cn("flex-1 py-3 text-sm font-medium rounded-xl transition-all relative", mode === "deposit" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900")}>Deposit</button>
        <button 
          type="button" 
          onClick={() => onModeChange("withdraw")} 
          className={cn("flex-1 py-3 text-sm font-medium rounded-xl transition-all relative", mode === "withdraw" ? "bg-white text-blue-600 shadow-sm" : "text-slate-600 hover:text-slate-900")}
        >
          Withdraw
          {withdrawBadgeCount !== undefined && withdrawBadgeCount > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (onWithdrawBadgeClick) {
                  onWithdrawBadgeClick();
                }
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && onWithdrawBadgeClick) {
                  e.preventDefault();
                  e.stopPropagation();
                  onWithdrawBadgeClick();
                }
              }}
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold hover:bg-red-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
              title={`${withdrawBadgeCount} pending withdrawal${withdrawBadgeCount > 1 ? 's' : ''} ready to claim`}
            >
              {withdrawBadgeCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
