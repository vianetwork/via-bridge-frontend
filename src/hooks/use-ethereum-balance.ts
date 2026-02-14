// src/hooks/use-ethereum-balance.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { getERC20Balance } from "@/services/ethereum/balance";
import { getPreferredWeb3ProviderAsync } from "@/utils/ethereum-provider";
import { eip6963Store } from "@/utils/eip6963-provider";
import { useWalletStore } from "@/store/wallet-store";

export interface EthereumBalance {
  balance: string | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export interface EthereumBalanceOptions {
  /** Token contract address */
  tokenAddress: string | undefined;
  /** Wallet address */
  walletAddress: string | null| undefined;
  /** Token decimals for formatting */
  decimals: number;
  /** Whether the wallet is on the correct network */
  isOnCorrectNetwork: boolean;
  /** Whether the wallet is connected */
  isConnected: boolean;
}

export function useEthereumBalance({tokenAddress, walletAddress, decimals, isOnCorrectNetwork, isConnected}: EthereumBalanceOptions): EthereumBalance {
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const selectedWalletRdns = useWalletStore((s) => s.selectedWallet);

  // Prevent multiple simultaneous fetches
  const isFetchingRef = useRef(false);

  const fetchBalance = useCallback(async () => {
    // Reset state if preconditions not met
    if (!isConnected) {
      setBalance(null);
      setError(null);
      return;
    }

    if (!walletAddress || !tokenAddress || !isOnCorrectNetwork) {
      setBalance(null);
      return;
    }

    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      return;
    }

    isFetchingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Resolve the correct provider: prefer the selected wallet, fall back to preferred
      const providerDetail = selectedWalletRdns
        ? eip6963Store.getProviderByRdns(selectedWalletRdns)
        : null;
      const bestProvider = providerDetail ?? (await getPreferredWeb3ProviderAsync());
      if (!bestProvider) {
        setBalance(null);
        setError(new Error("No wallet provider"));
        return;
      }

      const result = await getERC20Balance(bestProvider.provider, tokenAddress, walletAddress, decimals);

      setBalance(result.balance);

      if (result.error) {
        setError(new Error(result.error));
        console.warn("Failed to fetch balance:", result.error);
      }
    } catch (err) {
      console.error("Failed to fetch balance:", err);
      setBalance(null);
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [tokenAddress, walletAddress, decimals, isOnCorrectNetwork, isConnected, selectedWalletRdns]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Refetch when tab becomes visible for form components
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        isConnected &&
        isOnCorrectNetwork &&
        walletAddress &&
        tokenAddress
      ) {
        fetchBalance();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange",
      handleVisibilityChange);
  }, [fetchBalance, walletAddress, tokenAddress, isOnCorrectNetwork, isConnected]);

  return { balance, isLoading, error, refetch: fetchBalance };
}
