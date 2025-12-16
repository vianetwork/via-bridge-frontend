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
import { BRIDGE_ABI, MESSAGE_MANAGER_ABI } from "@/services/ethereum/abis";
import { EthereumNetwork, MESSAGE_MANAGER_ADDRESSES, ETHEREUM_NETWORK_CONFIG } from "@/services/ethereum/config";
import { ensureEthereumNetwork } from "@/utils/ensure-network";
import { useWalletState } from "@/hooks/use-wallet-state";
import { useWalletStore } from "@/store/wallet-store";
import { Transaction } from "@/store/wallet-store";
import { useNetworkSwitcher } from "@/hooks/use-network-switcher";

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
  const [isCheckingReadiness, setIsCheckingReadiness] = useState(false);
  const [readinessStatus, setReadinessStatus] = useState<Map<string, boolean>>(new Map());
  const [isMounted, setIsMounted] = useState(false);
  const { l1Address, isCorrectL1Network, isL1Connected, isMetamaskConnected, viaAddress } = useWalletState();
  const { fetchEthTransactions, checkL1Network, setIsL1Connected, setL1Address } = useWalletStore();
  const { switchToEthereum } = useNetworkSwitcher();

  // Track if component is mounted (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-switch to Sepolia when modal opens
  useEffect(() => {
    if (!open || !isMetamaskConnected) {
      setIsAutoSwitching(false);
      return;
    }

    const autoSwitchToSepolia = async () => {
      // Check current network state first
      await checkL1Network();
      
      // Get the latest network state from the store
      const store = useWalletStore.getState();
      
      // Ensure L1 connection is set if wallet is connected
      // If user has viaAddress but not l1Address, use viaAddress for L1 (same wallet, different network)
      if (isMetamaskConnected && viaAddress && !store.l1Address) {
        setL1Address(viaAddress);
        setIsL1Connected(true);
      }
      
      // If not on Sepolia, try to switch
      if (!store.isCorrectL1Network) {
        setIsAutoSwitching(true);
        try {
          const result = await switchToEthereum(EthereumNetwork.SEPOLIA);
          if (result.success) {
            // Refresh network state after switch
            await checkL1Network();
            // Ensure L1 connection is set after successful switch
            if (isMetamaskConnected && (viaAddress || l1Address)) {
              if (!store.l1Address && viaAddress) {
                setL1Address(viaAddress);
              }
              setIsL1Connected(true);
            }
          } else {
            console.warn("Auto-switch to Sepolia failed:", result.error);
          }
        } catch (error) {
          console.error("Error auto-switching to Sepolia:", error);
        } finally {
          setIsAutoSwitching(false);
        }
      } else {
        // Already on Sepolia, but ensure L1 connection is set
        if (isMetamaskConnected && (viaAddress || l1Address)) {
          if (!store.l1Address && viaAddress) {
            setL1Address(viaAddress);
          }
          setIsL1Connected(true);
        }
      }
    };

    autoSwitchToSepolia();
  }, [open, isMetamaskConnected, switchToEthereum, checkL1Network, viaAddress, l1Address, setIsL1Connected, setL1Address]);

  // Filter pending withdrawals (withdrawals that are ExecutedOnL2 but not yet ExecutedOnL1)
  const pendingWithdrawalsBase = transactions
    .filter(tx => 
      tx.type === 'withdraw' && 
      tx.isPendingClaim && 
      tx.withdrawalId && 
      tx.withdrawalShares &&
      tx.withdrawalPayloadHash
    )
    .map(tx => ({
      nonce: tx.withdrawalId!,
      shares: tx.withdrawalShares!,
      l1Vault: tx.withdrawalL1Vault || '',
      l1Receiver: tx.withdrawalRecipient || l1Address || viaAddress || '',
      payloadHash: tx.withdrawalPayloadHash!,
      l2TxHash: tx.txHash,
      l2ExplorerUrl: tx.l2ExplorerUrl || '',
      timestamp: tx.timestamp,
      symbol: tx.symbol || 'USDC',
    }))
    .filter(w => w.nonce && w.l1Receiver && w.l1Vault && w.payloadHash); // Only include withdrawals with all required fields

  // Check withdrawal readiness when transactions change (even when modal is closed)
  useEffect(() => {
    // Get pending withdrawals from transactions
    const withdrawalsToCheck = transactions
      .filter(tx => 
        tx.type === 'withdraw' && 
        tx.isPendingClaim && 
        tx.withdrawalId && 
        tx.withdrawalShares &&
        tx.withdrawalPayloadHash
      )
      .map(tx => ({
        payloadHash: tx.withdrawalPayloadHash!,
        l1Vault: tx.withdrawalL1Vault || '',
        nonce: tx.withdrawalId!,
      }))
      .filter(w => w.payloadHash && w.l1Vault);

    if (withdrawalsToCheck.length === 0) {
      // No withdrawals to check, report 0 (only on client-side after mount)
      if (isMounted && onReadyCountChange) {
        onReadyCountChange(0);
      }
      return;
    }

    const checkReadiness = async () => {
      setIsCheckingReadiness(true);
      try {
        const sepoliaConfig = ETHEREUM_NETWORK_CONFIG[EthereumNetwork.SEPOLIA];
        const provider = new ethers.JsonRpcProvider(sepoliaConfig.rpcUrls[0]);
        const messageManagerAddress = MESSAGE_MANAGER_ADDRESSES[EthereumNetwork.SEPOLIA];
        const messageManager = new ethers.Contract(messageManagerAddress, MESSAGE_MANAGER_ABI, provider);

        const statusMap = new Map<string, boolean>();

        // Check each withdrawal's readiness
        for (const withdrawal of withdrawalsToCheck) {
          try {
            const payloadHash = withdrawal.payloadHash.startsWith('0x') 
              ? withdrawal.payloadHash 
              : `0x${withdrawal.payloadHash}`;
            
            // Verify it's a valid 32-byte hash
            const hexWithoutPrefix = payloadHash.slice(2);
            if (hexWithoutPrefix.length !== 64) {
              console.error(`Invalid payload hash length for withdrawal ${withdrawal.nonce}: expected 64 hex chars, got ${hexWithoutPrefix.length}`);
              statusMap.set(withdrawal.payloadHash, false);
              continue;
            }
            
            // Use the payload hash directly (it's already keccak256, so it's 32 bytes)
            const [status, vault] = await messageManager.getMessageInfo(payloadHash);
            
            // Verify the vault matches
            const vaultMatches = vault.toLowerCase() === withdrawal.l1Vault.toLowerCase();
            statusMap.set(withdrawal.payloadHash, status && vaultMatches);
          } catch (error) {
            console.error(`Error checking readiness for withdrawal ${withdrawal.nonce}:`, error);
            // On error, assume not ready
            statusMap.set(withdrawal.payloadHash, false);
          }
        }

        setReadinessStatus(statusMap);
        
        // Report ready count to parent (only on client-side after mount)
        if (isMounted && onReadyCountChange) {
          const readyCount = Array.from(statusMap.values()).filter(v => v === true).length;
          onReadyCountChange(readyCount);
        }
      } catch (error) {
        console.error("Error checking withdrawal readiness:", error);
        // On error, report 0 ready (only on client-side after mount)
        if (isMounted && onReadyCountChange) {
          onReadyCountChange(0);
        }
      } finally {
        setIsCheckingReadiness(false);
      }
    };

    checkReadiness();
  }, [transactions, onReadyCountChange, isMounted]);

  // Map readiness status to withdrawals
  const pendingWithdrawals: PendingWithdrawal[] = pendingWithdrawalsBase.map(w => ({
    ...w,
    isReady: readinessStatus.get(w.payloadHash) ?? false,
  }));

  const handleClaim = async (withdrawal: PendingWithdrawal) => {
    if (!isCorrectL1Network) {
      toast.error("Please connect to Sepolia network", {
        description: "You need to be connected to Sepolia network to claim withdrawals.",
      });
      return;
    }

    try {
      setClaimingIds(prev => new Set(prev).add(withdrawal.nonce));

      // Ensure we're on Sepolia
      const networkResult = await ensureEthereumNetwork(EthereumNetwork.SEPOLIA);
      if (!networkResult.success || !networkResult.provider || !networkResult.signer) {
        throw new Error(networkResult.error || "Please switch your wallet to Sepolia network manually.");
      }

      const { signer } = networkResult;
      
      // Use L1 vault address from API response
      const vaultAddress = withdrawal.l1Vault;
      
      if (!vaultAddress || vaultAddress === "0x...") {
        throw new Error("Vault address not found in withdrawal data.");
      }

      const vaultContract = new ethers.Contract(vaultAddress, BRIDGE_ABI, signer);
      
      // Parse the nonce and shares from withdrawal data (from API)
      const nonce = BigInt(withdrawal.nonce);
      const shares = BigInt(withdrawal.shares);
      // Use recipient from API response
      const l1Receiver = withdrawal.l1Receiver;

      if (!l1Receiver) {
        throw new Error("L1 receiver address not found in withdrawal data");
      }

      console.log(`[Claim] Vault: ${vaultAddress}, Nonce: ${nonce}, Shares: ${shares}, Recipient: ${l1Receiver}`);

      toast.info("Claiming withdrawal...", {
        description: "Please sign the transaction in your wallet.",
      });

      const tx = await vaultContract.claimWithdrawal(nonce, shares, l1Receiver);
      
      toast.info("Transaction submitted", {
        description: "Waiting for confirmation...",
      });

      await tx.wait();

      toast.success("Withdrawal claimed successfully!", {
        description: `Transaction: ${tx.hash}`,
      });

      // Refresh transactions
      if (onClaimSuccess) {
        onClaimSuccess();
      } else {
        fetchEthTransactions();
      }
    } catch (error: any) {
      console.error("Claim error:", error);
      
      if (error.code === 'ACTION_REJECTED' || error.message?.includes('user rejected')) {
        toast.error("Transaction Rejected", {
          description: "User rejected the transaction.",
        });
      } else {
        toast.error("Claim Failed", {
          description: error.message || "Something went wrong. Please try again.",
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
            <Badge variant="secondary">{pendingWithdrawals.filter(w => w.isReady).length}</Badge>
          </DialogTitle>
        </DialogHeader>

        {isAutoSwitching && (
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Loader2 className="h-5 w-5 text-blue-600 flex-shrink-0 animate-spin" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Switching to Sepolia Network...
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
                Connect to Sepolia Network
              </p>
              <p className="text-xs text-amber-700 mt-1">
                You need to be connected to Sepolia network to claim withdrawals.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setIsAutoSwitching(true);
                try {
                  const result = await switchToEthereum(EthereumNetwork.SEPOLIA);
                  if (result.success) {
                    await checkL1Network();
                  }
                } catch (error) {
                  console.error("Error switching to Sepolia:", error);
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
                "Switch to Sepolia"
              )}
            </Button>
          </div>
        )}

        {isCheckingReadiness && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
            <p className="text-sm text-muted-foreground">Checking withdrawal readiness...</p>
          </div>
        )}

        {pendingWithdrawals.filter(w => w.isReady).length === 0 && !isCheckingReadiness ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No withdrawals ready to claim.</p>
            {pendingWithdrawals.length > 0 && (
              <p className="text-xs mt-2">
                {pendingWithdrawals.length} withdrawal{pendingWithdrawals.length > 1 ? 's' : ''} pending verification...
              </p>
            )}
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
                        {new Date(withdrawal.timestamp).toLocaleDateString()}
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

