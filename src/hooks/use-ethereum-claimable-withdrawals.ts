"use client";

import { useEffect, useMemo, useState } from "react";

import type { ClaimableWithdrawal } from "@/hooks/use-ethereum-claim";
import { useWalletState } from "@/hooks/use-wallet-state";
import { useWalletStore } from "@/store/wallet-store";
import { useWithdrawalReadinessStore } from "@/store/withdrawal-readiness-store";
import { TOKENS } from "@/services/bridge/tokens";

// Extends ClaimableWithdrawal with display-only fields that the UI needs,
// but the execution layer (useEthereumClaim.claim()) does not.
// Structurally compatible: claim() accepts ClaimableWithdrawalDisplay
// because it contains all claimableWithdrawal fields.
export type ClaimableWithdrawalDisplay = ClaimableWithdrawal & { decimals: number };

export interface UseEthereumClaimableWithdrawalsResult {
  pendingWithdrawals: ClaimableWithdrawalDisplay[];
  readyWithdrawals: ClaimableWithdrawalDisplay[];
  readyCount: number;
  isChecking: boolean;
}

export function useEthereumClaimableWithdrawals(): UseEthereumClaimableWithdrawalsResult {
  // Avoids triggering startPeriodicCheck during SSR/hydration when the store might not be populated yet
  const [ isMounted, setIsMounted ] = useState(false);
  const { l1Address, viaAddress } = useWalletState();
  const { ethTransactions } = useWalletStore();
  const { getReadiness, startPeriodicCheck, stopPeriodicCheck, isChecking } = useWithdrawalReadinessStore();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Map transactions to ClaimableWithdrawalDisplay format
  const pendingWithdrawals: ClaimableWithdrawalDisplay[] = useMemo(() => {
    return ethTransactions
      .filter(
        (tx) =>
          tx.type === "withdraw" &&
          tx.withdrawalId &&
          tx.withdrawalShares &&
          tx.withdrawalPayloadHash &&
          tx.withdrawalL1Vault
      )
      .map((tx) => {
        const symbol = tx.symbol || "USDC";
        return {
          nonce: tx.withdrawalId!,
          shares: tx.withdrawalShares!,
          decimals: TOKENS[symbol]?.decimals ?? 6,
          l1VaultAddress: tx.withdrawalL1Vault!,
          l1ReceiverAddress: tx.withdrawalRecipient || l1Address || viaAddress || "",
          payloadHash: tx.withdrawalPayloadHash!,
          viaWithdrawalTxHash: tx.txHash,
          viaExplorerUrl: tx.l2ExplorerUrl || "",
          timestamp: tx.timestamp,
          symbol,
          isReady: getReadiness(tx.withdrawalPayloadHash!) ?? false,
        };
      })
      .filter((w) => w.l1ReceiverAddress && w.l1VaultAddress);
  }, [ethTransactions, getReadiness, l1Address, viaAddress]);

  const readyWithdrawals = useMemo(() => pendingWithdrawals.filter((w) => w.isReady), [pendingWithdrawals]);

  // Set up periodic readiness checking (every 2 minutes)
  useEffect(() => {
    if (!isMounted) return;

    const withdrawalsToCheck = ethTransactions
      .filter(
        (tx) =>
          tx.type === "withdraw" &&
          tx.withdrawalId &&
          tx.withdrawalShares &&
          tx.withdrawalPayloadHash &&
          tx.withdrawalL1Vault
      )
      .map((tx) => ({
        payloadHash: tx.withdrawalPayloadHash!,
        l1Vault: tx.withdrawalL1Vault!,
        nonce: tx.withdrawalId!,
      }))
      .filter((w) => w.payloadHash && w.l1Vault);

    if (withdrawalsToCheck.length === 0) {
      stopPeriodicCheck();
      return;
    }

    startPeriodicCheck(withdrawalsToCheck, 120000); // 2 minutes
    return () => stopPeriodicCheck();
    }, [ethTransactions, isMounted, startPeriodicCheck, stopPeriodicCheck]);

  return {
    pendingWithdrawals,
    readyWithdrawals,
    readyCount: readyWithdrawals.length,
    isChecking,
  };
}