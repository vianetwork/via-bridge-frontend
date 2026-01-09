"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ExternalLink, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { ethers } from "ethers";
import { toast } from "sonner";
import { BRIDGE_ABI } from "@/services/ethereum/abis";
import { EthereumNetwork } from "@/services/ethereum/config";
import { ensureEthereumNetwork } from "@/utils/ensure-network";
import { useWalletState } from "@/hooks/use-wallet-state";
import { useWalletStore } from "@/store/wallet-store";
import { Transaction } from "@/store/wallet-store";
import { useSwitchChain, useChainId } from "wagmi";
import { CURRENT_CHAINS } from "@/services/config";
import { useWithdrawalReadinessStore } from "@/store/withdrawal-readiness-store";

interface PendingWithdrawal {
  nonce: string; // nonce (withdrawalId)
  shares: string; // withdrawalShares
  l1Vault: string; // L1 vault address from API
  l1Receiver: string; // L1 recipient address from API
  payloadHash: string; // payload hash for checking readiness
  l2TxHash: string;
  l2ExplorerUrl: string;
  timestamp: number;
  symbol: string;
  isReady?: boolean; // whether the withdrawal is ready to claim (checked via MessageManager)
}

interface PendingWithdrawalsProps {
  transactions: Transaction[];
  onClaimSuccess?: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReadyCountChange?: (count: number) => void;
}

export default function PendingWithdrawals({ transactions, onClaimSuccess, open, onOpenChange, onReadyCountChange }: PendingWithdrawalsProps) {
  const [claimingIds, setClaimingIds] = useState<Set<string>>(new Set());
  const [isAutoSwitching, setIsAutoSwitching] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { l1Address, isCorrectL1Network, isL1Connected, isMetamaskConnected, viaAddress } = useWalletState();
  const { fetchEthTransactions, checkL1Network, setIsL1Connected, setL1Address } = useWalletStore();
  const { switchChainAsync: switchChain } = useSwitchChain();
  const currentChainId = useChainId();
  // Derive if we need to switch to Ethereum
  const needsSwitch = open && isMetamaskConnected && currentChainId !== CURRENT_CHAINS.ethereum.id;

  const { 
    getReadiness, 
    startPeriodicCheck, 
    stopPeriodicCheck, 
    isChecking,
    markAsClaimed
  } = useWithdrawalReadinessStore();

  // Track if component is mounted (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Filter withdrawals - include all withdrawals with required data
  // We rely on on-chain checks (MessageManager + vault.withdrawalInfo) as source of truth
  // Don't filter by API status/l1ExplorerUrl since API might be out of sync
  const pendingWithdrawalsBase = transactions
    .filter(tx => 
      tx.type === 'withdraw' && 
      tx.withdrawalId && 
      tx.withdrawalShares &&
      tx.withdrawalPayloadHash &&
      tx.withdrawalL1Vault
    )
    .map(tx => ({
      nonce: tx.withdrawalId!,
      shares: tx.withdrawalShares!,
      l1Vault: tx.withdrawalL1Vault!,
      l1Receiver: tx.withdrawalRecipient || l1Address || viaAddress || '',
      payloadHash: tx.withdrawalPayloadHash!,
      l2TxHash: tx.txHash,
      l2ExplorerUrl: tx.l2ExplorerUrl || '',
      timestamp: tx.timestamp,
      symbol: tx.symbol || 'USDC',
    }))
    .filter(w => w.nonce && w.l1Receiver && w.l1Vault && w.payloadHash); // Only include withdrawals with all required fields

  // Set up periodic checking for withdrawal readiness (every 30 seconds)
  // This prevents spamming Alchemy API
  useEffect(() => {
    if (!isMounted) return;

    // Get withdrawals to check - we check ALL withdrawals with required data,
    // not just those marked as pending, since we determine readiness from MessageManager
    const withdrawalsToCheck = transactions
      .filter(tx => 
        tx.type === 'withdraw' && 
        tx.withdrawalId && 
        tx.withdrawalShares &&
        tx.withdrawalPayloadHash &&
        tx.withdrawalL1Vault
      )
      .map(tx => ({
        payloadHash: tx.withdrawalPayloadHash!,
        l1Vault: tx.withdrawalL1Vault!,
        nonce: tx.withdrawalId!,
      }))
      .filter(w => w.payloadHash && w.l1Vault);

    if (withdrawalsToCheck.length === 0) {
      // Stop periodic checking if no withdrawals
      stopPeriodicCheck();
      if (onReadyCountChange) {
        onReadyCountChange(0);
      }
      return;
    }

    // Start periodic checking (every 2 minute)
    // The store will filter which withdrawals actually need checking based on cooldown
    startPeriodicCheck(withdrawalsToCheck, 120000);

    // Cleanup on unmount or when dependencies change
    return () => {
      stopPeriodicCheck();
    };
  }, [transactions, isMounted, startPeriodicCheck, stopPeriodicCheck, onReadyCountChange]);

  // Update ready count when readiness changes
  useEffect(() => {
    if (!isMounted || !onReadyCountChange) return;

    const withdrawalsToCheck = transactions
      .filter(tx => 
        tx.type === 'withdraw' && 
        tx.withdrawalId && 
        tx.withdrawalPayloadHash
      );

    const readyCount = withdrawalsToCheck.filter(tx => {
      const readiness = getReadiness(tx.withdrawalPayloadHash!);
      return readiness === true;
    }).length;

    onReadyCountChange(readyCount);
  }, [transactions, isMounted, getReadiness, onReadyCountChange]);

  // Map readiness status to withdrawals from store
  const pendingWithdrawals: PendingWithdrawal[] = pendingWithdrawalsBase.map(w => {
    const isReady = getReadiness(w.payloadHash) ?? false;
    return {
      ...w,
      isReady,
    };
  });

  const handleClaim = async (withdrawal: PendingWithdrawal) => {
    // Check network state from store directly for more reliable check
    const store = useWalletStore.getState();
    const isOnSepolia = store.isCorrectL1Network;
    
    if (!isOnSepolia) {
      toast.error("Please connect to Sepolia network", {
        description: "You need to be connected to Sepolia network to claim withdrawals.",
      });
      return;
    }

    try {
      setClaimingIds(prev => new Set(prev).add(withdrawal.nonce));

      // Ensure we're on Sepolia and get signer
      const networkResult = await ensureEthereumNetwork(EthereumNetwork.SEPOLIA);
      if (!networkResult.success || !networkResult.provider || !networkResult.signer) {
        throw new Error(networkResult.error || "Please switch your wallet to Sepolia network manually.");
      }

      const { signer } = networkResult;
      
      // Use L1 vault address from API response
      const vaultAddress = withdrawal.l1Vault;
      
      if (!vaultAddress || vaultAddress === "0x..." || !ethers.isAddress(vaultAddress)) {
        throw new Error("Invalid vault address in withdrawal data.");
      }

      // Validate addresses
      const l1Receiver = withdrawal.l1Receiver;
      if (!l1Receiver || !ethers.isAddress(l1Receiver)) {
        throw new Error("Invalid L1 receiver address in withdrawal data");
      }

      // Parse the nonce and shares from withdrawal data (from API)
      let nonce: bigint;
      let shares: bigint;
      
      try {
        nonce = BigInt(withdrawal.nonce);
        shares = BigInt(withdrawal.shares);
      } catch (parseError) {
        throw new Error(`Invalid nonce or shares value: ${parseError}`);
      }

      if (nonce < 0n || shares <= 0n) {
        throw new Error("Invalid nonce or shares value");
      }

      const vaultContract = new ethers.Contract(vaultAddress, BRIDGE_ABI, signer);

      toast.info("Claiming withdrawal...", {
        description: "Please sign the transaction in your wallet.",
      });

      // Call claimWithdrawal with proper error handling
      let tx;
      try {
        tx = await vaultContract.claimWithdrawal(nonce, shares, l1Receiver);
      } catch (txError: any) {
        // Handle contract call errors
        if (txError.code === 'ACTION_REJECTED' || txError.message?.includes('user rejected') || txError.message?.includes('User rejected')) {
          throw { code: 'ACTION_REJECTED', message: 'User rejected the transaction' };
        }
        // Check for revert reasons
        if (txError.reason) {
          throw new Error(`Transaction failed: ${txError.reason}`);
        }
        if (txError.data) {
          throw new Error(`Transaction failed: ${txError.message || 'Unknown error'}`);
        }
        throw txError;
      }
      
      toast.info("Transaction submitted", {
        description: "Waiting for confirmation...",
      });

      try {
        await tx.wait();
      } catch (waitError: any) {
        // Transaction was sent but failed on-chain
        if (waitError.receipt && waitError.receipt.status === 0) {
          throw new Error("Transaction failed on-chain. Please check the transaction details.");
        }
        throw waitError;
      }

      toast.success("Withdrawal claimed successfully!", {
        description: `Transaction: ${tx.hash}`,
      });

      // Mark withdrawal as claimed so we stop checking it
      markAsClaimed(withdrawal.payloadHash);

      // Refresh transactions
      if (onClaimSuccess) {
        onClaimSuccess();
      } else {
        fetchEthTransactions();
      }
    } catch (error: any) {
      console.error("Claim error:", error);
      
      if (error.code === 'ACTION_REJECTED' || error.message?.includes('user rejected') || error.message?.includes('User rejected')) {
        toast.error("Transaction Rejected", {
          description: "You rejected the transaction in your wallet.",
        });
      } else if (error.message) {
        toast.error("Claim Failed", {
          description: error.message,
        });
      } else {
        toast.error("Claim Failed", {
          description: "Something went wrong. Please try again.",
        });
      }
    } finally {
      setClaimingIds(prev => {
        const next = new Set(prev);
        next.delete(withdrawal.nonce);
        return next;
      });
    }
  };

  // Can claim if on correct network and wallet is connected (either L1 or MetaMask)
  const canClaim = isCorrectL1Network && (isL1Connected || (isMetamaskConnected && (l1Address || viaAddress)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Withdrawals
            </span>
            {isMounted && <Badge variant="secondary">{pendingWithdrawals.filter(w => w.isReady).length}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {isAutoSwitching && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Loader2 className="h-5 w-5 text-blue-600 flex-shrink-0 animate-spin" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Switching to {CURRENT_CHAINS.ethereum.name}...
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Please approve the network switch in your wallet.
              </p>
            </div>
          </div>
        )}

        {!canClaim && !isAutoSwitching && (
          <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Connect to {CURRENT_CHAINS.ethereum.name}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                You need to be connected to {CURRENT_CHAINS.ethereum.name} to claim withdrawals.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setIsAutoSwitching(true);
                try {
                  await switchChain({ chainId: CURRENT_CHAINS.ethereum.id });
                  await checkL1Network();
                } catch (error) {
                  console.error(`Error switching to ${CURRENT_CHAINS.ethereum.name}:`, error);
                } finally {
                  setIsAutoSwitching(false);
                }
              }}
              disabled={isAutoSwitching}
            >
              {isAutoSwitching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Switching...
                </>
              ) : (
                `Switch to ${CURRENT_CHAINS.ethereum.name}`
              )}
            </Button>
          </div>
        )}

        {isChecking && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
            <p className="text-sm text-muted-foreground">Checking withdrawal readiness...</p>
          </div>
        )}

        {pendingWithdrawals.filter(w => w.isReady).length === 0 && !isChecking ? (
          <div className="text-center py-8 space-y-4">
            <div className="text-muted-foreground">
              <p>No withdrawals ready to claim.</p>
              {pendingWithdrawals.length > 0 && (
                <p className="text-xs mt-2">
                  {pendingWithdrawals.length} withdrawal{pendingWithdrawals.length > 1 ? 's' : ''} pending verification...
                </p>
              )}
            </div>
            
            {/* Info message about withdrawals */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium text-blue-900">
                    Withdrawal Processing
                  </p>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    After you submit a withdrawal, you can withdraw again immediately. 
                    When your withdrawal is ready to claim, it will appear here automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {pendingWithdrawals
              .filter(w => w.isReady) // Only show withdrawals that are ready
              .map((withdrawal) => {
              const isClaiming = claimingIds.has(withdrawal.nonce);

              return (
                <div
                  key={withdrawal.nonce}
                  className="flex items-center justify-between p-4 border rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-base">
                        {parseFloat(ethers.formatUnits(withdrawal.shares, 6)).toLocaleString(undefined, {
                          maximumFractionDigits: 6,
                        })}{" "}
                        {withdrawal.symbol}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Ready to Claim
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <a
                        href={withdrawal.l2ExplorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        View L2 Transaction
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <span>•</span>
                      <span>
                        {isMounted ? new Date(withdrawal.timestamp).toLocaleDateString() : ''}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleClaim(withdrawal)}
                    disabled={isClaiming || !canClaim}
                    size="sm"
                    className="ml-4"
                  >
                    {isClaiming ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Claiming...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Claim
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}


