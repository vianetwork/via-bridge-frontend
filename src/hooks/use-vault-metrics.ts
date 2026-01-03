import { useState, useEffect, useCallback } from "react";
import { fetchVaultMetrics } from "@/services/api/vault-metrics";
import { SUPPORTED_ASSETS } from "@/services/ethereum/config";
import type { BridgeMode } from "@/components/bridge/bridge-mode-tabs";

export interface VaultMetrics {
  tvl: string | null;
  apy: string | null;
  exchangeRate: string | null;
  exchangeRateDisplay: string | null;
  isLoading: boolean;
}

export interface UseVaultMetricsOptions {
  assetSymbol: string;
  isYieldEnabled: boolean;
  activeTab: BridgeMode;
  onApyUpdate?: (symbol: string, apy: string) => void;
}

export interface UseVaultMetricsReturn extends VaultMetrics {
  refetch: () => Promise<void>;
}

export interface ExpectedAmountData {
  expected: string;
  rate: string;
  inputAmount: string;
}

export function useVaultMetrics({
  assetSymbol,
  isYieldEnabled,
  activeTab,
  onApyUpdate,
}: UseVaultMetricsOptions): UseVaultMetricsReturn {
  const [tvl, setTvl] = useState<string | null>(null);
  const [apy, setApy] = useState<string | null>(null);
  const [exchangeRate, setExchangeRate] = useState<string | null>(null);
  const [exchangeRateDisplay, setExchangeRateDisplay] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMetrics = useCallback(async () => {
    setIsLoading(true);

    try {
      const asset = SUPPORTED_ASSETS.find((a) => a.symbol === assetSymbol) || SUPPORTED_ASSETS[0];
      const vaultType = isYieldEnabled ? "yield" : "normal";

      const metrics = await fetchVaultMetrics(
        asset.symbol,
        vaultType,
        "sepolia",
        asset.decimals
      );

      setTvl(metrics.tvl);

      if (metrics.apy && isYieldEnabled) {
        setApy(metrics.apy);
        onApyUpdate?.(asset.symbol, metrics.apy);
      } else {
        setApy(null);
      }

      if (isYieldEnabled && metrics.exchangeRate) {
        const rate = parseFloat(metrics.exchangeRate);
        setExchangeRate(rate.toString());

        const l2Symbol = asset.l2ValueSymbol || `v${asset.symbol}`;
        if (activeTab === "deposit") {
          setExchangeRateDisplay(`1 ${asset.symbol} = ${rate.toFixed(4)} ${l2Symbol}`);
        } else {
          const inverseRate = (1 / rate).toFixed(4);
          setExchangeRateDisplay(`1 ${l2Symbol} = ${inverseRate} ${asset.symbol}`);
        }
      } else {
        setExchangeRate(null);
        setExchangeRateDisplay(null);
      }
    } catch (error) {
      console.error("[useVaultMetrics] Error fetching vault metrics:", error);
      setTvl(null);
      setApy(null);
      setExchangeRate(null);
      setExchangeRateDisplay(null);
    } finally {
      setIsLoading(false);
    }
  }, [assetSymbol, isYieldEnabled, activeTab, onApyUpdate]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    tvl,
    apy,
    exchangeRate,
    exchangeRateDisplay,
    isLoading,
    refetch: fetchMetrics,
  };
}

export function calculateExpectedAmount(
  amount: number,
  exchangeRate: string | null,
  direction: BridgeMode,
  decimals: number
): ExpectedAmountData | null {
  if (!amount || !exchangeRate) {
    return null;
  }

  try {
    const rate = parseFloat(exchangeRate);
    if (isNaN(rate) || rate === 0) return null;

    let expected: number;
    let displayRate: string;

    if (direction === "deposit") {
      expected = amount * rate;
      displayRate = rate.toFixed(6);
    } else {
      const inverseRate = 1 / rate;
      expected = amount * inverseRate;
      displayRate = inverseRate.toFixed(6);
    }

    return {
      expected: expected.toFixed(decimals),
      rate: displayRate,
      inputAmount: amount.toFixed(decimals),
    };
  } catch (error) {
    console.error("Error calculating expected amount:", error);
    return null;
  }
}
