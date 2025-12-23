import { create } from 'zustand';
import { ethers } from 'ethers';
import { BRIDGE_ABI, MULTICALL_ABI } from "@/services/ethereum/abis";
import { EthereumNetwork, ETHEREUM_NETWORK_CONFIG, MULTICALL_ADDRESSES } from "@/services/ethereum/config";

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
    } catch {
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


      // Prepare withdrawals with normalized hashes
      const withdrawalsWithHashes = withdrawalsToCheck.map(withdrawal => {
        try {
          return {
            ...withdrawal,
            normalizedHash: normalizeHash(withdrawal.payloadHash)
          };
        } catch {
          return null;
        }
      }).filter((w): w is NonNullable<typeof w> => w !== null);

      if (withdrawalsWithHashes.length === 0) {
        set({ isChecking: false });
        return;
      }

      // Create vault contract interface for encoding calls
      const vaultInterface = new ethers.Interface(BRIDGE_ABI);
      
      // Build multicall array: each call is (target: vault address, gasLimit: gas limit, callData: encoded withdrawalInfo call)
      // Using a reasonable gas limit for each call (100k should be enough for a view function)
      const GAS_LIMIT_PER_CALL = 100000n;
      const calls = withdrawalsWithHashes.map(withdrawal => ({
        target: withdrawal.l1Vault,
        gasLimit: GAS_LIMIT_PER_CALL,
        callData: vaultInterface.encodeFunctionData("withdrawalInfo", [withdrawal.normalizedHash])
      }));

      // Execute multicall using staticCall since it's a read-only operation
      let results: Array<{ success: boolean; gasUsed: bigint; returnData: string }> = [];
      
      try {
        const multicallAddress = MULTICALL_ADDRESSES[EthereumNetwork.SEPOLIA];
        // First verify the contract exists by checking code
        const code = await provider.getCode(multicallAddress);
        if (code === "0x" || code === "0x0") {
          throw new Error(`Multicall contract not found at address ${multicallAddress} on Sepolia`);
        }

        const multicallContract = new ethers.Contract(multicallAddress, MULTICALL_ABI, provider);
        // Use staticCall for read-only operations
        const [, multicallResults] = await multicallContract.multicall.staticCall(calls);
        results = multicallResults;
      } catch {
        // If multicall fails completely, skip this check cycle
        // This could happen if the contract doesn't exist or RPC is having issues
        set({ isChecking: false });
        return; // Skip processing and wait for next interval
      }

      // Validate results array length matches withdrawals
      if (!results || results.length !== withdrawalsWithHashes.length) {
        set({ isChecking: false });
        return;
      }

      // Process multicall results
      for (let i = 0; i < withdrawalsWithHashes.length; i++) {
        const withdrawal = withdrawalsWithHashes[i];
        const result = results[i];

        if (!result || !result.success) {
          statusMap.set(withdrawal.normalizedHash, false);
          continue;
        }

        try {
          // Decode the result: (bool isClaimed, uint256 batchNumber)
          const decoded = vaultInterface.decodeFunctionResult("withdrawalInfo", result.returnData);
          const [isClaimed, batchNumber] = decoded;

          // If claimed, mark it and stop checking it in the future
          if (isClaimed) {
            set(state => {
              const newClaimedMap = new Map(state.claimedMap);
              newClaimedMap.set(withdrawal.normalizedHash, true);
              // Remove from readiness map since it's claimed
              const newReadinessMap = new Map(state.readinessMap);
              newReadinessMap.delete(withdrawal.normalizedHash);
              return { 
                claimedMap: newClaimedMap,
                readinessMap: newReadinessMap
              };
            });
            // Skip further processing for this withdrawal - don't check claimed withdrawals
            continue;
          }

          // Only process withdrawals where batchNumber is 0 (message doesn't exist yet) OR isClaimed is false
          // - If batchNumber is 0: withdrawal doesn't exist yet (not ready, keep checking)
          // - If batchNumber > 0 and isClaimed is false: withdrawal is ready to claim
          const messageExists = batchNumber > 0n;
          const isReady = messageExists && !isClaimed;
          
          statusMap.set(withdrawal.normalizedHash, isReady);
        } catch {
          statusMap.set(withdrawal.normalizedHash, false);
        }
      }

      // Update last check timestamps for all checked withdrawals
      set(state => {
        const newCheckMap = new Map(state.lastCheckMap);
        withdrawalsWithHashes.forEach(withdrawal => {
          newCheckMap.set(withdrawal.normalizedHash, timestamp);
        });
        return { lastCheckMap: newCheckMap };
      });

      // Update readiness map
      set(state => {
        const newMap = new Map(state.readinessMap);
        statusMap.forEach((isReady, hash) => {
          newMap.set(hash, isReady);
        });
        return { readinessMap: newMap };
      });
    } catch {
      // Error checking withdrawal readiness
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
    } catch {
      // Error marking hash as claimed
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

