// src/hooks/use-ethereum-claim.ts
import { useCallback, useMemo, useState } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { getAddChainParams } from "@/lib/wagmi/chains";
import { GetCurrentRoute } from "@/services/bridge/routes";
import { executeEthereumClaim } from "@/services/ethereum/claim";
import { useWithdrawalReadinessStore } from "@/store/withdrawal-readiness-store";
import { useEthersSigner } from "@/hooks/use-ethers-signer";

export interface ClaimableWithdrawal {
  nonce: string;
  shares: string;
  l1VaultAddress: string;
  l1ReceiverAddress: string;
  payloadHash: string;
  viaWithdrawalTxHash: string;
  viaExplorerUrl: string;
  timestamp: number;
  symbol: string;
  isReady: boolean;
}

export function useEthereumClaim() {
  const [claimingIds, setClaimingIds] = useState<Set<string>>(new Set());
  const { markAsClaimed } = useWithdrawalReadinessStore();

  // Claim happens on Ethereum L1 (withdraw destination)
  const route = useMemo(() => GetCurrentRoute("withdraw", "ethereum"), []);
  const ethereumChainId = route.fromNetwork.chainId!;

  const currentChainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const addEthereumChainParameter = useMemo(() => getAddChainParams(ethereumChainId), [ethereumChainId]);

  const ensureOnEthereumNetwork = useCallback(async () => {
    if (currentChainId === ethereumChainId) return;
    await switchChainAsync({
      chainId: ethereumChainId,
      ...(addEthereumChainParameter ? { addEthereumChainParameter } : {}),
    });
  }, [addEthereumChainParameter, currentChainId, ethereumChainId, switchChainAsync]);

  // Ensure the signer is derived for the correct chain
  const signer = useEthersSigner({ chainId: ethereumChainId });
  const isClaiming = useCallback((nonce: string) => claimingIds.has(nonce), [claimingIds]);

  const claim = useCallback(async (withdrawal: ClaimableWithdrawal) => {
    if (!signer) throw new Error("Wallet not ready. Connect your wallet first.");
    setClaimingIds((prev) => new Set(prev).add(withdrawal.nonce));
    try {
      await ensureOnEthereumNetwork();

      const result = await executeEthereumClaim({
        l1VaultAddress: withdrawal.l1VaultAddress,
        nonce: withdrawal.nonce,
        shares: withdrawal.shares,
        l1Receiver: withdrawal.l1ReceiverAddress,
        signer
      });

      markAsClaimed(withdrawal.payloadHash);
      return result;
    } finally {
      setClaimingIds((prev) => {
        const next = new Set(prev);
        next.delete(withdrawal.nonce);
        return next;
      });
    }
  }, [ensureOnEthereumNetwork, markAsClaimed, signer]);

  return { claim, isClaiming, ensureOnEthereumNetwork, ethereumChainId };
}