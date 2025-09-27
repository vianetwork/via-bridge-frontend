"use client";

import * as React from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { BalanceSlider, type BalanceSliderProps } from "@/components/ui/balance-slider";

export type FormAmountSliderProps<TFieldValues extends FieldValues> =
  Omit<BalanceSliderProps, "value" | "onChange"> & {
    form: UseFormReturn<TFieldValues>
    name: Path<TFieldValues>
    decimals?: number;
  }

export function FormAmountSlider<TFieldValues extends FieldValues>({
  form,
  name,
  decimals = 8,
  ...rest
}: FormAmountSliderProps<TFieldValues>) {
  // Read the current form field (string or number) and normalize to a number for the slider
  const raw = form.watch(name) as unknown as string | number | undefined;
  const numberValue = (() => {
    const n = Number.parseFloat(String(raw ?? "0"));
    return Number.isFinite(n) ? n : 0;
  })();

  // // Use provided decimals from slider props (default 8)
  // const { decimals = 8, ...rest } = sliderProps

  const handleChange = React.useCallback(
    (newNumber: number) => {
      // Store as a fixed-precision string in the form (RHF field is commonly a string)
      form.setValue(name, newNumber.toFixed(decimals) as any, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    },
    [form, name, decimals]
  );

  return (
    <BalanceSlider
      value={numberValue}
      onChange={handleChange}
      decimals={decimals}
      {...rest}
    />
  );
}