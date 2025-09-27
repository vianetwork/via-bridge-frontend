import * as React from "react";
import { cn } from "@/lib/utils";

export interface BalanceSliderProps {
  balance: number | null | undefined
  min: number;  // min BTC allowed
  feeReserve?: number;  // reserve BTC for fees (max = balance - reserve)
  value: number; // current BTC value (parent-controlled)
  onChange: (v: number) => void;  // emit new BTC amount

  // UI options
  isLoading?: boolean;
  pulseWhenEmpty?: boolean;
  unit?: string // display unit (default "BTC")
  ariaLabel: string; //a11y label

  // Tailwind styling
  progressClassName?: string; // e.g. "bg-green-500"
  sliderAccentClassName?: string; // e.g. "accent-green-500"

  // Formatting
  decimals?: number; // default 8 for BTC
}

export function BalanceSlider({
  balance,
  min,
  feeReserve = 0,
  value,
  onChange,
  isLoading = false,
  pulseWhenEmpty = false,
  unit = "BTC",
  ariaLabel = "Amount slider",
  progressClassName = "bg-green-500",
  sliderAccentClassName = "accent-green-500",
  decimals = 8,
}: BalanceSliderProps) {
  const bal = typeof balance === "number" ? balance: 0;
  const reserve =  Math.max(0, feeReserve || 0);
  const max = Math.max(0, bal - reserve);
  const hasRange = max >= min && bal > 0;

  // clamp incoming value
  const isFiniteNum = Number.isFinite(value);
  const current = isFiniteNum ? value : min;
  const clamped = Math.min(Math.max(current, min), hasRange ? max : min);

  // fill percentage 
  const range = Math.max(max - min, 1e-12);
  const pct = Math.min(Math.max(((clamped - min) / range) * 100, 0), 100);

  //handle when user moves the slider
  const handleChange = (next: number) => {
    if (!Number.isFinite(next)) return;
    const clampedNext = Math.min(Math.max(next, min), hasRange ? max : min);
    onChange(clampedNext);
  };

  return (
    <>
      <div className="mt-2">
        <div className="flex justify-between items-center text-[11px] text-muted-foreground mb-1">
          <div className="flex items-center gap-1.5">
            <span>Using {pct.toFixed(1)}% of balance</span>
          </div>
          <span className="font-medium text-foreground/80">
            {Number.isFinite(clamped) ? clamped.toFixed(decimals) : (0).toFixed(decimals)} / {bal.toFixed(decimals)} {unit}
          </span>
        </div>
      </div>
<div className="relative w-full">
  {/* Progress bar */}
  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
    <div
      className={cn("h-1.5 rounded-l-full", progressClassName)}
      style={{ width: `${pct}%` }}
    />
  </div>

  {/* Slider overlay */}
  <input
    type="range"
    min={min}
    max={hasRange ? max : min}
    step="any"
    value={clamped}
    onChange={(e) => handleChange(Number(e.target.value))}
    disabled={!hasRange || isLoading}
    className={cn(
      "absolute inset-0 w-full h-1.5 appearance-none bg-transparent cursor-pointer disabled:cursor-not-allowed",
      sliderAccentClassName
    )}
    aria-label={ariaLabel}
  />

  {pulseWhenEmpty && (
    <span
      className="pointer-events-none absolute z-10 top-1/2 -translate-x-1/2 -translate-y-1/2 inline-flex w-4 h-4"
      style={{ left: `calc(${pct}% + 9px)` }}
      aria-hidden="true"
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-green-400 opacity-75"></span>
    </span>
  )}
</div>
    </>
  );
}
