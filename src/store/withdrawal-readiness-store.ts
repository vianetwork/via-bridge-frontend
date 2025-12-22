import { create } from 'zustand';
import { ethers } from 'ethers';
import { BRIDGE_ABI } from "@/services/ethereum/abis";
import { EthereumNetwork, ETHEREUM_NETWORK_CONFIG } from "@/services/ethereum/config";

interface WithdrawalCheck {
  payloadHash: string;
  l1Vault: string;
  nonce: string;
  lastChecked?: number;
  isReady?: boolean;
  error?: string;
}

interface WithdrawalReadinessState {
  // Map of payloadHash (lowercase) -> readiness status
  readinessMap: Map<string, boolean>;
  // Map of payloadHash -> last check timestamp
  lastCheckMap: Map<string, number>;
  // Map of payloadHash -> whether withdrawal is claimed (so we can skip checking)
  claimedMap: Map<string, boolean>;
  // Interval ID for periodic checking
  checkIntervalId: NodeJS.Timeout | null;
  // Whether checking is in progress
  isChecking: boolean;
  
  // Actions
  setReadiness: (payloadHash: string, isReady: boolean) => void;
  getReadiness: (payloadHash: string) => boolean | undefined;
  checkWithdrawals: (withdrawals: WithdrawalCheck[], minCooldownMs?: number) => Promise<void>;
  startPeriodicCheck: (withdrawals: WithdrawalCheck[], intervalMs?: number) => void;
  stopPeriodicCheck: () => void;
  clearReadiness: () => void;
  markAsClaimed: (payloadHash: string) => void;
}

// Normalize payload hash for consistent storage
function normalizeHash(hash: string): string {
  const normalized = hash.startsWith('0x') ? hash.toLowerCase() : `0x${hash.toLowerCase()}`;
  // Ensure it's a valid 32-byte hash
  const hexWithoutPrefix = normalized.slice(2);
  if (hexWithoutPrefix.length !== 64) {
    throw new Error(`Invalid payload hash length: expected 64 hex chars, got ${hexWithoutPrefix.length}`);
  }
  return normalized;
}

export const useWithdrawalReadinessStore = create<WithdrawalReadinessState>((set, get) => ({
  readinessMap: new Map(),
  lastCheckMap: new Map(),
  claimedMap: new Map(),
  checkIntervalId: null,
  isChecking: false,

  setReadiness: (payloadHash, isReady) => {
    const normalized = normalizeHash(payloadHash);
    set(state => {
      const newMap = new Map(state.readinessMap);
      newMap.set(normalized, isReady);
      return { readinessMap: newMap };
    });
  },

  getReadiness: (payloadHash) => {
    try {
      const normalized = normalizeHash(payloadHash);
      return get().readinessMap.get(normalized);
    } catch (error) {
      console.error(`[WithdrawalReadinessStore] Error normalizing hash:`, error);
      return undefined;
    }
  },

  checkWithdrawals: async (withdrawals, minCooldownMs = 20000) => {
    if (get().isChecking) {
      return; // Already checking, skip this call
    }

    set({ isChecking: true });

    try {
      const sepoliaConfig = ETHEREUM_NETWORK_CONFIG[EthereumNetwork.SEPOLIA];
      const provider = new ethers.JsonRpcProvider(sepoliaConfig.rpcUrls[0]);

      const statusMap = new Map<string, boolean>();
      const timestamp = Date.now();
      const { lastCheckMap, claimedMap, readinessMap } = get();

      // Filter withdrawals to only check those that need checking:
      // 1. Not already claimed
      // 2. Haven't been checked recently (respect cooldown)
      // 3. Or if ready, check less frequently (every 2 minutes instead of 30 seconds)
      const withdrawalsToCheck = withdrawals.filter(withdrawal => {
        try {
          const payloadHash = normalizeHash(withdrawal.payloadHash);
          
          // Skip if already claimed
          if (claimedMap.get(payloadHash)) {
            return false;
          }

          const lastChecked = lastCheckMap.get(payloadHash);
          const isCurrentlyReady = readinessMap.get(payloadHash) === true;
          
          // If never checked, check it
          if (!lastChecked) {
            return true;
          }

          const timeSinceLastCheck = timestamp - lastChecked;
          
          // If ready, check less frequently (every 4 minutes)
          if (isCurrentlyReady) {
            return timeSinceLastCheck >= 240000; // 4 minutes
          }
          
          // If not ready, check more frequently but still respect cooldown
          return timeSinceLastCheck >= minCooldownMs;
        } catch {
          // If normalization fails, skip this withdrawal
          return false;
        }
      });

      if (withdrawalsToCheck.length === 0) {
        // Nothing to check, skip API calls
        set({ isChecking: false });
        return;
      }

      console.log(`[WithdrawalReadinessStore] Checking ${withdrawalsToCheck.length} of ${withdrawals.length} withdrawals (skipped ${withdrawals.length - withdrawalsToCheck.length} due to cooldown/claimed status)`);

      // Check each withdrawal's readiness
      for (const withdrawal of withdrawalsToCheck) {
        try {
          const payloadHash = normalizeHash(withdrawal.payloadHash);
          
          // Check the vault contract to see if this withdrawal exists and is claimed
          const vaultContract = new ethers.Contract(withdrawal.l1Vault, BRIDGE_ABI, provider);
          const [isClaimed, batchNumber] = await vaultContract.withdrawalInfo(payloadHash);

          // First check if the message exists (batchNumber > 0)
          // If batchNumber is 0, the withdrawal doesn't exist yet
          const messageExists = batchNumber > 0n;
          
          // Ready if withdrawal exists in mapping and is not claimed
          const isReady = messageExists && !isClaimed;
          statusMap.set(payloadHash, isReady);
          
          // If claimed, mark it so we stop checking it
          if (isClaimed) {
            set(state => {
              const newClaimedMap = new Map(state.claimedMap);
              newClaimedMap.set(payloadHash, true);
              return { claimedMap: newClaimedMap };
            });
          }
          
          // Update last check timestamp
          set(state => {
            const newCheckMap = new Map(state.lastCheckMap);
            newCheckMap.set(payloadHash, timestamp);
            return { lastCheckMap: newCheckMap };
          });
        } catch (error: any) {
          console.error(`[WithdrawalReadinessStore] Error checking withdrawal ${withdrawal.nonce}:`, error);
          // On error, try to normalize hash and mark as not ready
          try {
            const payloadHash = normalizeHash(withdrawal.payloadHash);
            statusMap.set(payloadHash, false);
          } catch (normalizeError) {
            // If normalization fails, skip this withdrawal
            console.error(`[WithdrawalReadinessStore] Failed to normalize hash for withdrawal ${withdrawal.nonce}:`, normalizeError);
          }
        }
      }

      // Update readiness map
      set(state => {
        const newMap = new Map(state.readinessMap);
        statusMap.forEach((isReady, hash) => {
          newMap.set(hash, isReady);
        });
        return { readinessMap: newMap };
      });
    } catch (error) {
      console.error("[WithdrawalReadinessStore] Error checking withdrawal readiness:", error);
    } finally {
      set({ isChecking: false });
    }
  },

  startPeriodicCheck: (withdrawals, intervalMs = 30000) => {
    // Stop any existing interval
    get().stopPeriodicCheck();

    if (withdrawals.length === 0) {
      return;
    }

    // Do an initial check
    get().checkWithdrawals(withdrawals);

    // Set up periodic checking
    const intervalId = setInterval(() => {
      get().checkWithdrawals(withdrawals);
    }, intervalMs);

    set({ checkIntervalId: intervalId });
  },

  stopPeriodicCheck: () => {
    const { checkIntervalId } = get();
    if (checkIntervalId) {
      clearInterval(checkIntervalId);
      set({ checkIntervalId: null });
    }
  },

  markAsClaimed: (payloadHash) => {
    try {
      const normalized = normalizeHash(payloadHash);
      set(state => {
        const newClaimedMap = new Map(state.claimedMap);
        newClaimedMap.set(normalized, true);
        // Also remove from readiness map since it's claimed
        const newReadinessMap = new Map(state.readinessMap);
        newReadinessMap.delete(normalized);
        return { 
          claimedMap: newClaimedMap,
          readinessMap: newReadinessMap
        };
      });
    } catch (error) {
      console.error(`[WithdrawalReadinessStore] Error marking hash as claimed:`, error);
    }
  },

  clearReadiness: () => {
    set({
      readinessMap: new Map(),
      lastCheckMap: new Map(),
      claimedMap: new Map(),
    });
  },
}));

