import axios from "axios";
import { ethers } from "ethers";
import { API_BASE_URL } from "../config";

export interface VaultMetricsResponse {
  success: boolean;
  data: {
    tvl?: string; // Hex string
    apy?: number;
    exchange_rate?: string; // Hex string (for yield vaults)
    shares_for_one_asset?: string; // Hex string
    assets_for_one_share?: string; // Hex string
  } | null;
  message?: string;
}

export interface VaultMetrics {
  tvl: string | null;
  apy: string | null;
  exchangeRate: string | null; // Formatted as "1.0000" - represents assets per share
}

/**
 * Fetches vault metrics (TVL, APY, exchange rate) from the backend API
 * @param assetSymbol - The asset symbol (e.g., "USDC")
 * @param vaultType - "yield" or "normal"
 * @param network - "sepolia" or "ethereum" (for L1 vaults)
 * @param decimals - Token decimals for formatting
 * @returns VaultMetrics object with formatted values
 */
export async function fetchVaultMetrics(
  assetSymbol: string,
  vaultType: "yield" | "normal",
  network: "sepolia" | "ethereum" = "sepolia",
  decimals: number = 6
): Promise<VaultMetrics> {
  try {
    // Use API base URL for vault metrics endpoint
    const vaultMetricsUrl = `${API_BASE_URL}/eth/vault/metrics`;
    const response = await axios.get<VaultMetricsResponse>(
      vaultMetricsUrl,
      {
        params: {
          asset_symbol: assetSymbol,
          vault_type: vaultType,
          network: network,
        },
      }
    );

    if (!response.data.success || !response.data.data) {
      return {
        tvl: null,
        apy: null,
        exchangeRate: null,
      };
    }

    const data = response.data.data;

    // Format TVL
    let tvl: string | null = null;
    if (data.tvl) {
      const tvlValue = BigInt(data.tvl);
      const tvlNumber = Number(ethers.formatUnits(tvlValue, decimals));
      tvl = formatVaultTvl(tvlNumber);
    }

    // Format APY
    let apy: string | null = null;
    if (data.apy !== undefined) {
      apy = `${data.apy.toFixed(2)}%`;
    }

    // Format exchange rate (assets per share)
    let exchangeRate: string | null = null;
    if (data.exchange_rate) {
      // Exchange rate is typically in wei format (1e18)
      const rateValue = BigInt(data.exchange_rate);
      const rateNumber = Number(ethers.formatUnits(rateValue, 18));
      exchangeRate = rateNumber.toFixed(4);
    } else if (data.assets_for_one_share) {
      // Alternative: use assets_for_one_share
      const rateValue = BigInt(data.assets_for_one_share);
      const rateNumber = Number(ethers.formatUnits(rateValue, decimals));
      exchangeRate = rateNumber.toFixed(4);
    }

    return {
      tvl,
      apy,
      exchangeRate,
    };
  } catch (error) {
    console.error("[fetchVaultMetrics] Error fetching vault metrics:", error);
    return {
      tvl: null,
      apy: null,
      exchangeRate: null,
    };
  }
}

/**
 * Helper function to format TVL values
 */
function formatVaultTvl(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  } else if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(2)}K`;
  } else {
    return `$${amount.toFixed(2)}`;
  }
}

