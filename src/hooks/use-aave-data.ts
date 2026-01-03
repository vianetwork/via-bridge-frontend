// src/hooks/use-aave-data.ts
import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { fetchAaveData } from "@/services/ethereum/aave";
import { SUPPORTED_ASSETS, EthereumNetwork } from "@/services/ethereum/config";
import { EthereumSepolia } from "@/lib/wagmi/chains";

export interface AaveApyState {
  apys: Record<string, string>;
  isLoading: boolean;
}

/**
 * Hook to fetch APY data from Aave for supported assets.
 *
 * Always fetches from Ethereum Sepolia network (for now), regardless of connected wallet network.
 * This ensures consistent APY data display even when the user is on different networks.
 *
 * Uses viem chain definitions from lib/wagmi/chains.ts as the single source of truth
 * for chain configuration (RPC URLs, chain IDs, etc.).
 *
 * @returns {AaveApyState} Object containing apys record and loading state
 *
 * @example
 * ```tsx
 * const { apys, isLoading } = useAaveData();
 * // apys = { "USDC": "5.23%", "USDT": "4.80%" }
 * ```
 */
export function useAaveData(): AaveApyState {
  const [apys, setApys] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);

      try {
        // Always use Ethereum Sepolia regardless of connected chain
        // Use viem chain definition - EthereumSepolia.id = 11155111 (number)
        const rpcUrl = EthereumSepolia.rpcUrls.default.http[0];
        const readProvider = new ethers.JsonRpcProvider(rpcUrl);

        await Promise.all(
          SUPPORTED_ASSETS.map(async (asset) => {
            if (!asset.active) {
              return; // skip inactive assets
            }

            const address = asset.addresses?.[EthereumNetwork.SEPOLIA];

            if (address && address !== "0x0000000000000000000000000000000000000000") {
              const { apy } = await fetchAaveData(
                EthereumSepolia.id, // Use viem chain id 11155111
                address,
                readProvider
              );
              setApys((prev) => ({ ...prev, [asset.symbol]: apy }));
            } else {
              setApys((prev) => ({ ...prev, [asset.symbol]: asset.apy }));
            }
          })
        );
      } catch (error) {
        console.error("Error in useAaveData:", error);
        // fallback to defaults
        const defaultApys: Record<string, string> = {};
        SUPPORTED_ASSETS.forEach((asset) => {
          defaultApys[asset.symbol] = asset.apy;
        });
        setApys(defaultApys);
      } finally {
        setIsLoading(false);
      }
    }

    // Only fetch data once on mount, not when chainId changes
    fetchData();
  }, []);

  return { apys, isLoading };
}
