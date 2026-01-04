import { useState, useEffect, useCallback } from "react";
import { fetchVaultMetrics, VaultMetrics } from "@/services/api/vault-metrics";
import { SUPPORTED_ASSETS } from "@/services/ethereum/config";

export type { VaultMetrics } from "@/services/api/vault-metrics";

/** Options for useVaultMetrics hook */
export interface UseVaultMetricsOptions {
  /** Selected asset symbol (e.g., "USDC") */
  assetSymbol: string;
  /** Whether yield mode is enabled */
  isYieldEnabled: boolean;
}

/** Return type for useVaultMetrics hook*/
export interface UseVaultMetricsReturn {
  /** Raw vault metrics from API */
  metrics: VaultMetrics;
  /** Loading state */
  isLoading: boolean;
  /** Manually refetch metrics */
  refetch: () => void;
}

const EMPTY_METRICS: VaultMetrics = {
  tvl: null,
  apy: null,
  exchangeRate: null,
};

/**
 * Hook to fetch vault metrics (TVL, APY, exchange rate) from the API.
 *
 * Returns raw data - formatting should be done in the component.
 * Only refetches when assetSymbol or isYieldEnabled changes.
 *
 * @example
 * ```tsx
 * const { metrics: vaultMetrics, isLoading } = useVaultMetrics({
 *   assetSymbol: selectedAssetSymbol,
 *   isYieldEnabled,
 * });
 *
 * // Derive exchange rate display string in a component
 * const exchangeRateDisplay = useMemo(() => {
 *   if (!isYieldEnabled || !vaultMetrics.exchangeRate) return null;
 *
 *   const underlyingSymbol = selectedAsset.symbol; // "USDC"
 *   const vaultShareSymbol = selectedAsset.l2ValueSymbol || `v${underlyingSymbol}`; // "vUSDC"
 *
 *   return formatVaultRate(
 *     vaultMetrics.exchangeRate,
 *     underlyingSymbol,
 *     vaultShareSymbol,
 *     activeTab);
 * }, [isYieldEnabled, vaultMetrics.exchangeRate, selectedAsset, activeTab]);
 * ```
 */
export function useVaultMetrics({ assetSymbol, isYieldEnabled}: UseVaultMetricsOptions): UseVaultMetricsReturn {
  const [metrics, setMetrics] = useState<VaultMetrics>(EMPTY_METRICS);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const asset = SUPPORTED_ASSETS.find((a) => a.symbol === assetSymbol) || SUPPORTED_ASSETS[0];
      const vaultType = isYieldEnabled ? "yield" : "normal";
      const metrics = await fetchVaultMetrics(asset.symbol, vaultType, "sepolia", asset.decimals);
      setMetrics(metrics);
    } catch (error) {
      console.error("[useVaultMetrics] Error fetching vault metrics:", error);
      setMetrics(EMPTY_METRICS);
    } finally {
      setIsLoading(false);
    }
  }, [assetSymbol, isYieldEnabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { metrics, isLoading, refetch: fetchData };
}
