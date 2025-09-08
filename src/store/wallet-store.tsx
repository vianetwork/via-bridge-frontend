import { create } from 'zustand';
import { Layer } from '@/services/config';
import { createEvent } from "@/utils/events";
import { getMetaMaskProvider } from "@/utils/ethereum-provider";
import { fetchUserTransactions, mapApiTransactionsToAppFormat, fetchFeeEstimation } from "@/services/api";

// Create events for wallet state changes
export const walletEvents = {
  metamaskConnected: createEvent<void>('metamask-connected'),
  xverseConnected: createEvent<void>('xverse-connected'),
  metamaskDisconnected: createEvent<void>('metamask-disconnected'),
  xverseDisconnected: createEvent<void>('xverse-disconnected'),
  networkChanged: createEvent<void>('network-changed'),
};

export type TransactionStatus =
  'Pending' |
  'InProgress' |
  'Processed' |
  'Failed' |
  'ExecutedOnL2' |
  'CommittedToL1' |
  'ProvedOnL1' |
  'ExecutedOnL1' |
  'Processed' |
  'Failed'

interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw';
  amount: string;
  status: TransactionStatus;
  timestamp: number;
  txHash: string;
  l1ExplorerUrl?: string;
  l2ExplorerUrl?: string;
}

interface FeeEstimation {
  fee: number;
}

// LocalStorage utility functions
const LOCALSTORAGE_KEY = 'wallet_local_transactions';

const loadLocalTransactionsFromStorage = (): Transaction[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(LOCALSTORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load transactions from localStorage:', error);
    return [];
  }
};

const saveLocalTransactionsToStorage = (transactions: Transaction[]): void => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(transactions));
  } catch (error) {
    console.error('Failed to save transactions to localStorage:', error);
  }
};

const removeTransactionsFromStorage = (txHashes: string[]): void => {
  if (typeof window === 'undefined') return;

  try {
    const stored = loadLocalTransactionsFromStorage();
    const filtered = stored.filter(tx => !txHashes.includes(tx.txHash));
    saveLocalTransactionsToStorage(filtered);
  } catch (error) {
    console.error('Failed to remove transactions from localStorage:', error);
  }
};

interface WalletState {
  bitcoinAddress: string | null;
  bitcoinPublicKey: string | null;
  viaAddress: string | null;
  isXverseConnected: boolean;
  isMetamaskConnected: boolean;
  isCorrectBitcoinNetwork: boolean;
  isCorrectViaNetwork: boolean;
  transactions: Transaction[];
  isLoadingTransactions: boolean;
  isLoadingFeeEstimation: boolean;
  localTransactions: Transaction[];
  feeEstimation: FeeEstimation | null;

  // Actions
  setBitcoinAddress: (address: string | null) => void;
  setBitcoinPublicKey: (publicKey: string | null) => void;
  setViaAddress: (address: string | null) => void;
  setIsXverseConnected: (connected: boolean) => void;
  setIsMetamaskConnected: (connected: boolean) => void;
  setIsCorrectBitcoinNetwork: (correct: boolean) => void;
  setIsCorrectViaNetwork: (correct: boolean) => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'timestamp'>) => void;
  updateTransactionStatus: (txHash: string, status: Transaction['status']) => void;
  clearTransactions: () => void;
  fetchTransactions: () => Promise<void>;
  fetchFeeEstimation: (amount: number) => Promise<void>;
  addLocalTransaction: (tx: Omit<Transaction, 'id' | 'timestamp'>) => void;
  removeLocalTransaction: (txHash: string) => void;
  mergeTransactions: (apiTransactions: Transaction[]) => Transaction[];
  loadLocalTransactions: () => void;
  clearLocalTransactions: () => void;

  // Wallet operations
  connectXverse: () => Promise<boolean>;
  connectMetamask: () => Promise<boolean>;
  disconnectXverse: () => void;
  disconnectMetamask: () => void;
  switchNetwork: (layer: Layer) => void;

  // Helper methods
  checkXverseConnection: () => Promise<void>;
  checkMetamaskNetwork: () => Promise<boolean | void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  // State
  bitcoinAddress: null,
  bitcoinPublicKey: null,
  viaAddress: null,
  isXverseConnected: false,
  isMetamaskConnected: false,
  isCorrectBitcoinNetwork: false,
  isCorrectViaNetwork: false,
  transactions: [],
  isLoadingTransactions: false,
  isLoadingFeeEstimation: false,
  localTransactions: [],
  feeEstimation: null,

  // Setters
  setBitcoinAddress: (address) => set({ bitcoinAddress: address }),
  setBitcoinPublicKey: (publicKey) => set({ bitcoinPublicKey: publicKey }),
  setViaAddress: (address) => set({ viaAddress: address }),
  setIsXverseConnected: (connected) => set({ isXverseConnected: connected }),
  setIsMetamaskConnected: (connected) => set({ isMetamaskConnected: connected }),
  setIsCorrectBitcoinNetwork: (correct) => set({ isCorrectBitcoinNetwork: correct }),
  setIsCorrectViaNetwork: (correct) => set({ isCorrectViaNetwork: correct }),

  addTransaction: (tx) => set(state => ({
    transactions: [
      {
        ...tx,
        id: tx.txHash,
        timestamp: Date.now(),
      },
      ...state.transactions
    ]
  })),

  updateTransactionStatus: (txHash, status) => set(state => ({
    transactions: state.transactions.map(tx =>
      tx.txHash === txHash ? { ...tx, status } : tx
    )
  })),

  clearTransactions: () => set({ transactions: [] }),

  // Enhanced local transaction methods with localStorage
  addLocalTransaction: (tx) => {
    const newTransaction: Transaction = {
      ...tx,
      id: tx.txHash,
      timestamp: Date.now(),
    };

    set(state => {
      const updatedLocalTransactions = [newTransaction, ...state.localTransactions];

      // Save to localStorage
      saveLocalTransactionsToStorage(updatedLocalTransactions);

      return {
        localTransactions: updatedLocalTransactions
      };
    });
  },

  removeLocalTransaction: (txHash) => {
    set(state => {
      const updatedLocalTransactions = state.localTransactions.filter(tx => tx.txHash !== txHash);

      // Update localStorage
      saveLocalTransactionsToStorage(updatedLocalTransactions);

      return {
        localTransactions: updatedLocalTransactions
      };
    });
  },

  loadLocalTransactions: () => {
    const localTransactions = loadLocalTransactionsFromStorage();
    set({ localTransactions });
  },

  clearLocalTransactions: () => {
    set({ localTransactions: [] });
    saveLocalTransactionsToStorage([]);
  },

  mergeTransactions: (apiTransactions) => {
    const { localTransactions } = get();

    // Filter out local transactions that are now in the API response
    const apiTxHashes = apiTransactions.map(tx => tx.txHash);
    const remainingLocalTxs = localTransactions.filter(tx => !apiTxHashes.includes(tx.txHash));

    // Merge and sort all transactions
    return [...apiTransactions, ...remainingLocalTxs].sort((a, b) => b.timestamp - a.timestamp);
  },

  fetchFeeEstimation: async (amount: number) => {
    if (amount == 0) {
      return;
    }

    try {
      set({ isLoadingFeeEstimation: true });
      const fee = await fetchFeeEstimation(amount);
      set(() => ({
        feeEstimation: {
          fee
        }
      }));
    } catch (error) {
      console.error(error);
    } finally {
      set({ isLoadingFeeEstimation: false });
    }

  },

  fetchTransactions: async () => {
    const { bitcoinAddress, viaAddress } = get();

    if (!bitcoinAddress && !viaAddress) {
      return;
    }

    try {
      set({ isLoadingTransactions: true });
      const apiTransactions = await fetchUserTransactions(bitcoinAddress, viaAddress);
      const formattedTransactions = mapApiTransactionsToAppFormat(apiTransactions);

      // Use the mergeTransactions method to combine API and local transactions
      const mergedTransactions = get().mergeTransactions(formattedTransactions);

      set({ transactions: mergedTransactions });

      // Get transaction hashes that are now confirmed by the API
      const confirmedTxHashes = formattedTransactions.map(tx => tx.txHash);

      // Remove confirmed transactions from local storage and state
      if (confirmedTxHashes.length > 0) {
        removeTransactionsFromStorage(confirmedTxHashes);

        // Update local transactions state by removing confirmed ones
        set(state => ({
          localTransactions: state.localTransactions.filter(tx =>
            !confirmedTxHashes.includes(tx.txHash)
          )
        }));
      }
    } catch (error) {
      console.error("Failed to fetch transactions:", error);
    } finally {
      set({ isLoadingTransactions: false });
    }
  },

  // Wallet operations
  connectXverse: async () => {
    try {
      console.log("🔹 Connecting to Xverse wallet...");

      const { request, RpcErrorCode, AddressPurpose } = await import("sats-connect");

      const response = await request("wallet_connect", {
        addresses: [AddressPurpose.Payment, AddressPurpose.Ordinals],
        message: "Connect to VIA Bridge app",
      });

      if (response.status !== "success") {
        if (response.error.code === RpcErrorCode.USER_REJECTION) {
          console.log("Connection rejected by user");
          return false;
        }
        throw new Error(`Connection failed: ${response.error.message || "Unknown error"}`);
      }

      const addresses = response.result.addresses;
      if (addresses.length === 0) {
        throw new Error("No addresses returned from wallet");
      }

      set({
        bitcoinAddress: addresses[0].address,
        bitcoinPublicKey: addresses[0].publicKey,
        isXverseConnected: true
      });

      // Check network after connection
      await get().checkXverseConnection();

      // Load local transactions after connecting
      get().loadLocalTransactions();

      console.log("✅ Xverse wallet connected, addresses:", addresses);
      walletEvents.xverseConnected.emit();
      return true;
    } catch (error) {
      console.error("Xverse connection error:", error);
      throw error;
    }
  },

  connectMetamask: async () => {
    try {
      console.log("🔹 Connecting to MetaMask wallet...");
            
      const provider = getMetaMaskProvider();
      if (!provider) {
        throw new Error("MetaMask not found. Please install MetaMask extension.");
      }

      const accounts = await provider.request({
        method: "eth_requestAccounts",
      }) as string[];

      const address = accounts[0];
      set({
        viaAddress: address,
        isMetamaskConnected: true
      });

      // Check network after connection
      await get().checkMetamaskNetwork();

      // Load local transactions after connecting
      get().loadLocalTransactions();

      console.log("✅ MetaMask wallet connected, address:", address);
      walletEvents.metamaskConnected.emit();
      return true;
    } catch (error: any) {
      const METAMASK_USER_REJECTION_ERROR_CODE = 4001;
      if (error.code === METAMASK_USER_REJECTION_ERROR_CODE) {
        console.log("Connection rejected by user");
        return false;
      }
      console.error("MetaMask connection error:", error);
      throw error;
    }
  },

  disconnectXverse: async () => {
    try {
      const { request } = await import("sats-connect");
      await request("wallet_disconnect", null);
    } catch (error) {
      console.error("Xverse disconnect error:", error);
    } finally {
      set({
        bitcoinAddress: null,
        bitcoinPublicKey: null,
        isXverseConnected: false,
        isCorrectBitcoinNetwork: false
      });
      walletEvents.xverseDisconnected.emit();
    }
  },

  disconnectMetamask: () => {
    set({
      viaAddress: null,
      isMetamaskConnected: false,
      isCorrectViaNetwork: false
    });
    walletEvents.metamaskDisconnected.emit();
  },

  switchNetwork: async (layer: Layer) => {
    try {
      const { isXverseConnected, isMetamaskConnected } = get();

      switch (layer) {
        case Layer.L1:
          // For Xverse, we need to disconnect and reconnect
          if (isXverseConnected) {
            await get().disconnectXverse();
            return await get().connectXverse();
          }
          break;
        case Layer.L2:
          if (isMetamaskConnected) {
            // For MetaMask, we can request network switch
            const provider = getMetaMaskProvider();
            if (!provider) {
              throw new Error("MetaMask not found or not accessible");
            }

            const { VIA_NETWORK_CONFIG, BRIDGE_CONFIG } = await import("@/services/config");
            const expectedChainId = VIA_NETWORK_CONFIG[BRIDGE_CONFIG.defaultNetwork].chainId;

            try {
              await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: expectedChainId }],
              });
              set({ isCorrectViaNetwork: true });
              return true;
            } catch (switchError: any) {
              // This error code indicates that the chain has not been added to MetaMask
              if (switchError.code === 4902) {
                await provider.request({
                  method: 'wallet_addEthereumChain',
                  params: [VIA_NETWORK_CONFIG[BRIDGE_CONFIG.defaultNetwork]],
                });
                set({ isCorrectViaNetwork: true });
                return true;
              }
              throw switchError;
            }
          }
          break;
      }
    } catch (error) {
      console.error("Network switch error:", error);
    }

    walletEvents.networkChanged.emit();
  },

  // Helper methods
  checkXverseConnection: async () => {
    try {
      const { request, AddressPurpose } = await import("sats-connect");

      const res = await request('wallet_getNetwork', null) as any;
      if (!res.status) {
        set({ isXverseConnected: false });
        return;
      }

      // Check if connected to the correct network
      const { BRIDGE_CONFIG } = await import("@/services/config");
      const expectedNetwork = BRIDGE_CONFIG.defaultNetwork;
      const connectedNetwork = res.result.bitcoin.name.toLowerCase();
      const isCorrect = expectedNetwork === connectedNetwork;

      set({ isCorrectBitcoinNetwork: isCorrect });

      const response = await request("getAddresses", {
        purposes: [AddressPurpose.Payment],
      });

      if (response.status === "success") {
        const connectedPaymentAddress = response.result.addresses.find(
          (address) => address.purpose === AddressPurpose.Payment
        );

        if (connectedPaymentAddress) {
          set({
            bitcoinAddress: connectedPaymentAddress.address,
            bitcoinPublicKey: connectedPaymentAddress.publicKey,
            isXverseConnected: true
          });

          // Load local transactions when wallet is already connected
          get().loadLocalTransactions();

          console.log("✅ Xverse wallet already connected");
        }
      }
    } catch (error) {
      console.log(`Error to check Xverse connection ${error}`);
      // Silently handle error - wallet is not connected
      set({ isXverseConnected: false });
    }
  },

  checkMetamaskNetwork: async () => {
    try {
      const provider = getMetaMaskProvider();
      if (!provider) {
        console.warn("MetaMask provider not found");
        return;
      }

      const { VIA_NETWORK_CONFIG, BRIDGE_CONFIG } = await import("@/services/config");
      const expectedChainId = VIA_NETWORK_CONFIG[BRIDGE_CONFIG.defaultNetwork].chainId;
      const chainId = await provider.request({ method: 'eth_chainId' });
      const isCorrect = chainId === expectedChainId;

      set({ isCorrectViaNetwork: isCorrect });

      if (!isCorrect) {
        try {
          await provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: expectedChainId }],
          });
          set({ isCorrectViaNetwork: true });
          return true;
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            await provider.request({
              method: 'wallet_addEthereumChain',
              params: [VIA_NETWORK_CONFIG[BRIDGE_CONFIG.defaultNetwork]],
            });
            set({ isCorrectViaNetwork: true });
            return true;
          }
          throw switchError;
        }
      }
    } catch (error) {
      console.error("Error checking MetaMask network:", error);
    }
  }
}));