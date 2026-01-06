// src/hooks/use-ethereum-balance.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { getERC20Balance } from "@/services/ethereum/balance";

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
      const result = await getERC20Balance(tokenAddress, walletAddress, decimals);

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
  }, [tokenAddress, walletAddress, decimals, isOnCorrectNetwork, isConnected]);

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
