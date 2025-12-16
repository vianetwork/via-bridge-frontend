import { create } from 'zustand';
import { Layer } from '@/services/config';
import { createEvent } from "@/utils/events";
import { getPreferredWeb3ProviderAsync } from "@/utils/ethereum-provider";
import { WalletNotFoundError } from "@/utils/wallet-errors";
import { fetchUserTransactions, mapApiTransactionsToAppFormat, fetchEthUserTransactions, mapEthApiTransactionsToAppFormat, fetchFeeEstimation, fetchDepositFeeEstimation } from "@/services/api";
import { maskAddress } from "@/utils";
import { resolveDisplayName, resolveIcon } from '@/utils/wallet-metadata';
import { switchToL1Network, switchToL2Network } from "@/utils/network-switcher";
import { switchToEthereumNetwork } from "@/utils/network-switcher";
import { EthereumNetwork } from "@/services/ethereum/config";

// Create events for wallet state changes
export const walletEvents = {
  metamaskConnected: createEvent<void>('metamask-connected'),
  xverseConnected: createEvent<void>('xverse-connected'),
  metamaskDisconnected: createEvent<void>('metamask-disconnected'),
  xverseDisconnected: createEvent<void>('xverse-disconnected'),
  networkChanged: createEvent<void>('network-changed'),
  walletChanged: createEvent<string>('wallet-changed'),
  walletRefreshed: createEvent<void>('wallet-refreshed'),
};

export type TransactionStatus =
  'Pending' |
  'InProgress' |
  'ExecutedOnL2' |
  'CommittedToL1' |
  'ProvedOnL1' |
  'ExecutedOnL1' |
  'Processed' |
  'Failed'

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdraw';
  amount: string;
  status: TransactionStatus;
  timestamp: number;
  txHash: string;
  l1ExplorerUrl?: string;
  l2ExplorerUrl?: string;
  symbol?: string;
  // Additional fields for pending withdrawals
  withdrawalId?: string; // nonce for claiming
  withdrawalShares?: string; // shares amount for claiming
  withdrawalRecipient?: string; // L1 recipient address for claiming
  withdrawalL1Vault?: string; // L1 vault address for claiming
  withdrawalPayloadHash?: string; // payload hash for checking readiness via MessageManager
  isPendingClaim?: boolean; // true if withdrawal is ready to claim on L1
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
  chainId: string | null;
  l1Address: string | null;
  isXverseConnected: boolean;
  isMetamaskConnected: boolean;
  isL1Connected: boolean;
  isCorrectBitcoinNetwork: boolean;
  isCorrectViaNetwork: boolean;
  isCorrectL1Network: boolean;
  btcTransactions: Transaction[];
  ethTransactions: Transaction[];
  transactions: Transaction[]; // Deprecated? Kept for compatibility if needed, or we can just remove it.
  isLoadingTransactions: boolean;
  isLoadingFeeEstimation: boolean;
  localTransactions: Transaction[];
  feeEstimation: FeeEstimation | null;

  // Multi wallet support
  availableWallets: Array<{ name: string, rdns: string, icon?: string }>;
  selectedWallet: string | null; // rdns of selected wallet

  // Actions
  setBitcoinAddress: (address: string | null) => void;
  setBitcoinPublicKey: (publicKey: string | null) => void;
  setViaAddress: (address: string | null) => void;
  setL1Address: (address: string | null) => void;
  setChainId: (chainId: string | null) => void;
  setIsXverseConnected: (connected: boolean) => void;
  setIsMetamaskConnected: (connected: boolean) => void;
  setIsL1Connected: (connected: boolean) => void;
  setIsCorrectBitcoinNetwork: (correct: boolean) => void;
  setIsCorrectViaNetwork: (correct: boolean) => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'timestamp'>) => void;
  updateTransactionStatus: (txHash: string, status: Transaction['status']) => void;
  clearTransactions: () => void;
  fetchTransactions: () => Promise<void>; // Deprecated or wrapper
  fetchBtcTransactions: () => Promise<void>;
  fetchEthTransactions: () => Promise<void>;

  fetchFeeEstimation: (amount: number) => Promise<void>;
  fetchDepositFeeEstimation(amount: number): Promise<void>;
  resetFeeEstimation: () => void;
  addLocalTransaction: (tx: Omit<Transaction, 'id' | 'timestamp'>) => void;
  removeLocalTransaction: (txHash: string) => void;
  mergeTransactions: (apiTransactions: Transaction[], type?: 'BTC' | 'ETH') => Transaction[];
  loadLocalTransactions: () => void;
  clearLocalTransactions: () => void;

  setAvailableWallets: (wallets: Array<{ name: string, rdns: string, icon?: string }>) => void;
  setSelectedWallet: (rdns: string) => void;

  // Wallet operations
  connectXverse: () => Promise<boolean>;
  connectMetamask: () => Promise<boolean>;
  connectL1Wallet: () => Promise<boolean>;
  disconnectXverse: () => void;
  disconnectMetamask: () => void;
  switchNetwork: (layer: Layer) => Promise<boolean | void>;
  connectWallet: (rdns: string) => Promise<boolean>;
  refreshAvailableWallets: () => void;

  // Helper methods
  checkXverseConnection: () => Promise<void>;
  checkMetamaskNetwork: () => Promise<boolean | void>;
  checkL1Network: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  // State
  bitcoinAddress: null,
  bitcoinPublicKey: null,
  viaAddress: null,
  chainId: null,
  l1Address: null,
  isXverseConnected: false,
  isMetamaskConnected: false,
  isL1Connected: false,
  isCorrectBitcoinNetwork: false,
  isCorrectViaNetwork: false,
  isCorrectL1Network: false,
  btcTransactions: [],
  ethTransactions: [],
  transactions: [],
  isLoadingTransactions: false,
  isLoadingFeeEstimation: false,
  localTransactions: [],
  feeEstimation: null,

  availableWallets: [],
  selectedWallet: null,

  // Setters
  setBitcoinAddress: (address) => set({ bitcoinAddress: address }),
  setBitcoinPublicKey: (publicKey) => set({ bitcoinPublicKey: publicKey }),
  setViaAddress: (address) => set({ viaAddress: address }),
  setL1Address: (address) => set({ l1Address: address }),
  setIsXverseConnected: (connected) => set({ isXverseConnected: connected }),
  setIsMetamaskConnected: (connected) => set({ isMetamaskConnected: connected }),
  setIsL1Connected: (connected) => set({ isL1Connected: connected }),
  setIsCorrectBitcoinNetwork: (correct) => set({ isCorrectBitcoinNetwork: correct }),
  setIsCorrectViaNetwork: (correct) => set({ isCorrectViaNetwork: correct }),


  setChainId: (chainId) => set({ chainId }),

  setAvailableWallets: (wallets) => set({ availableWallets: wallets }),
  setSelectedWallet: (rdns) => {
    const prev = get().selectedWallet;
    if (prev !== rdns) {
      set({ selectedWallet: rdns });
      // Notify services that the active EVM wallet changed
      walletEvents.walletChanged.emit(rdns);
    }
  },
  addTransaction: (tx) => {
    const newTx = {
      ...tx,
      id: tx.txHash,
      timestamp: Date.now(),
    };

    set(state => {
      const isBTC = tx.symbol === 'BTC';
      return {
        transactions: [newTx, ...state.transactions], // Legacy
        btcTransactions: isBTC ? [newTx, ...state.btcTransactions] : state.btcTransactions,
        ethTransactions: !isBTC ? [newTx, ...state.ethTransactions] : state.ethTransactions,
      };
    });
  },

  updateTransactionStatus: (txHash, status) => set(state => ({
    transactions: state.transactions.map(tx =>
      tx.txHash === txHash ? { ...tx, status } : tx
    ),
    btcTransactions: state.btcTransactions.map(tx =>
      tx.txHash === txHash ? { ...tx, status } : tx
    ),
    ethTransactions: state.ethTransactions.map(tx =>
      tx.txHash === txHash ? { ...tx, status } : tx
    )
  })),

  clearTransactions: () => set({ transactions: [], btcTransactions: [], ethTransactions: [] }),

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

      const isBTC = tx.symbol === 'BTC';

      return {
        localTransactions: updatedLocalTransactions,
        // Optimistically update the relevant list too
        btcTransactions: isBTC ? [newTransaction, ...state.btcTransactions] : state.btcTransactions,
        ethTransactions: !isBTC ? [newTransaction, ...state.ethTransactions] : state.ethTransactions
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

  mergeTransactions: (apiTransactions, type) => {
    const { localTransactions } = get();

    // Filter local transactions based on type if specified
    const relevantLocalTxs = type
      ? localTransactions.filter(tx => type === 'BTC' ? tx.symbol === 'BTC' : tx.symbol !== 'BTC')
      : localTransactions;

    // Filter out local transactions that are now in the API response
    const apiTxHashes = apiTransactions.map(tx => tx.txHash);
    const remainingLocalTxs = relevantLocalTxs.filter(tx => !apiTxHashes.includes(tx.txHash));

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

  fetchDepositFeeEstimation: async (amount: number) => {
    if (amount == 0) return;

    // latest-wins gating
    // increment a local request counter and only commit if still the latest
    const g = get() as any;
    g.__depReqId = (g.__depReqId || 0) + 1;
    const reqId = g.__depReqId;

    try {
      set({ isLoadingFeeEstimation: true });
      const fee = await fetchDepositFeeEstimation(amount);
      // only commit if this is the latest request
      if ((get() as any).__depReqId === reqId) {
        set(() => ({ feeEstimation: { fee } }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      set({ isLoadingFeeEstimation: false });
    }
  },

  resetFeeEstimation: () => {
    set({ feeEstimation: null, isLoadingFeeEstimation: false });
  },

  // Deprecated parent fetcher
  fetchTransactions: async () => {
    await Promise.all([
      get().fetchBtcTransactions(),
      get().fetchEthTransactions()
    ]);
  },

  fetchBtcTransactions: async () => {
    const { bitcoinAddress, viaAddress } = get();
    if (!bitcoinAddress || !viaAddress) {
      set({ btcTransactions: [] });
      return;
    }

    try {
      set({ isLoadingTransactions: true });
      const apiTransactions = await fetchUserTransactions(bitcoinAddress, viaAddress);
      const formattedTransactions = mapApiTransactionsToAppFormat(apiTransactions)
        .map(tx => ({ ...tx, symbol: 'BTC' }));

      const merged = get().mergeTransactions(formattedTransactions, 'BTC');
      set({ btcTransactions: merged });

      // Clean up confirmed local
      const confirmedTxHashes = formattedTransactions.map(tx => tx.txHash);
      if (confirmedTxHashes.length > 0) {
        removeTransactionsFromStorage(confirmedTxHashes);
        set(state => ({
          localTransactions: state.localTransactions.filter(tx => !confirmedTxHashes.includes(tx.txHash))
        }));
      }

    } catch (e) {
      console.error("Error fetching BTC transactions", e);
    } finally {
      set({ isLoadingTransactions: false });
    }
  },

  fetchEthTransactions: async () => {
    const { l1Address, viaAddress } = get();
    
    // If we have viaAddress but no l1Address, use viaAddress for both (same wallet, different networks)
    const effectiveL1Address = l1Address || viaAddress;
    const effectiveL2Address = viaAddress || l1Address;
    
    if (!effectiveL1Address || !effectiveL2Address) {
      set({ ethTransactions: [] });
      return;
    }

    try {
      set({ isLoadingTransactions: true });
      const apiTransactions = await fetchEthUserTransactions(effectiveL1Address, effectiveL2Address);
      const formattedTransactions = mapEthApiTransactionsToAppFormat(apiTransactions);

      const merged = get().mergeTransactions(formattedTransactions, 'ETH');
      set({ ethTransactions: merged });

      // Clean up confirmed local
      const confirmedTxHashes = formattedTransactions.map(tx => tx.txHash);
      if (confirmedTxHashes.length > 0) {
        removeTransactionsFromStorage(confirmedTxHashes);
        set(state => ({
          localTransactions: state.localTransactions.filter(tx => !confirmedTxHashes.includes(tx.txHash))
        }));
      }
    } catch (e) {
      console.error("Error fetching ETH transactions", e);
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
      console.log("🔹 Connecting to wallet and switching to VIA network...");

      const bestProvider = await getPreferredWeb3ProviderAsync();
      if (!bestProvider) {
        throw new Error("No wallet found. Please install MetaMask, Rabby, or another compatible wallet extension.");
      }

      console.log(`🔗 Using ${bestProvider.name} (${bestProvider.rdns})`);

      // Ensure selection reflects the chosen provider and emits walletChanged if changed
      get().setSelectedWallet(bestProvider.rdns);

      // Step 1: Request account connection
      const accounts = await bestProvider.provider.request({
        method: "eth_requestAccounts",
      }) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned from wallet");
      }

      const address = accounts[0];
      set({
        viaAddress: address,
        isMetamaskConnected: true
      });

      // Step 2: Automatically switch to VIA network
      console.log("🔄 Switching to VIA network...");
      const networkResult = await switchToL2Network();
      
      if (networkResult.success) {
        set({ isCorrectViaNetwork: true });
        console.log("✅ Connected to wallet and switched to VIA network");
        walletEvents.networkChanged.emit();
      } else {
        // If switch failed, still mark as connected but network is incorrect
        // User will see a warning but can proceed
        console.warn("⚠️ Connected but network switch failed:", networkResult.error);
        await get().checkMetamaskNetwork();
      }

      // Load local transactions after connecting
      get().loadLocalTransactions();

      console.log("✅ Wallet connected, address:", address);
      walletEvents.metamaskConnected.emit();
      return true;
    } catch (error: any) {
      const USER_REJECTION_ERROR_CODE = 4001;
      if (error.code === USER_REJECTION_ERROR_CODE) {
        console.log("Connection rejected by user");
        return false;
      }
      console.error("Wallet connection error:", error);
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
          if (!isXverseConnected) {
            console.warn("Cannot switch L1 network: Xverse wallet not connected");
            return false;
          }
          const l1Result = await switchToL1Network();
          if (l1Result.success) {
            if (l1Result.switched) {
              await get().checkXverseConnection();
            }
            walletEvents.networkChanged.emit();
            return l1Result.success;
          }
          return false;

        case Layer.L2:
          if (!isMetamaskConnected) {
            console.warn("Cannot switch L2 network: EVM wallet not connected");
            return false;
          }
          const l2Result = await switchToL2Network();
          if (l2Result.success) {
            set({ isCorrectViaNetwork: true });
            walletEvents.networkChanged.emit();
            return true;
          }
          return false;

        default:
          console.warn(`Unknown layer: ${layer}`);
          return false;
      }
    } catch (error) {
      console.error("Network switch error:", error);
      walletEvents.networkChanged.emit();
      return false;
    }
  },

  connectWallet: async (rdns: string) => {
    try {
      console.log(`🔹 Connecting to wallet with rdns: ${rdns}`);

      const { eip6963Store } = await import("@/utils/eip6963-provider");
      const providerDetail = eip6963Store.getProviderByRdns(rdns);

      if (!providerDetail) {
        throw new WalletNotFoundError(rdns);
      }

      const provider = providerDetail.provider;

      // Request account access
      const accounts = await provider.request({
        method: "eth_requestAccounts",
      }) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error("No accounts returned from wallet");
      }

      const address = accounts[0];
      set({
        viaAddress: address,
        isMetamaskConnected: true, // For now, treating all EIP-6963 wallets as "metamask-like"
      });
      // Route selection through setter to emit WalletChanged
      get().setSelectedWallet(rdns);

      // Check network after connection
      await get().checkMetamaskNetwork();

      console.log(`✅ Wallet ${providerDetail.info.name} connected, address:`, maskAddress(address));
      walletEvents.metamaskConnected.emit();
      return true;
    } catch (error: any) {
      const USER_REJECTION_ERROR_CODE = 4001;
      if (error.code === USER_REJECTION_ERROR_CODE) {
        console.log("Connection rejected by user");
        return false;
      }
      console.error(`Wallet connection error for ${rdns}:`, error);
      throw error;
    }
  },

  refreshAvailableWallets: () => {
    try {
      console.log("🔄 Refreshing available wallets...");
      import("@/utils/eip6963-provider")
        .then(({ eip6963Store }) => {
          const providers = eip6963Store.getAllWalletProviders();
          const wallets = providers.map((provider: EIP6963ProviderDetail) => ({
            name: resolveDisplayName(provider),
            rdns: provider.info.rdns,
            icon: resolveIcon(provider)
          }));

          set({ availableWallets: wallets });
          console.log(`✅ Found ${wallets.length} available wallets:`, wallets);
          walletEvents.walletRefreshed.emit();
        })
        .catch((error: any) => {
          console.error("Error refreshing available wallets:", error);
          // Don't throw, just log the error and continue with empty array
          set({ availableWallets: [] });
        });
    } catch (error: any) {
      console.error("Error refreshing available wallets:", error);
      // Don't throw, just log the error and continue with empty array
      set({ availableWallets: [] });
    }
  },

  // Helper methods
  checkXverseConnection: async () => {
    try {
      const { request, AddressPurpose } = await import("sats-connect");

      const res = await request('wallet_getNetwork', null) as any;
      if (res?.status !== "success") {
        set({ isXverseConnected: false });
        return;
      }

      // Check if connected to the correct network
      const { BRIDGE_CONFIG } = await import("@/services/config");
      const expectedNetwork = BRIDGE_CONFIG.defaultNetwork;
      // Xverse may report the test network as "Signet" while our config uses Testnet 4
      // Normalize both wallet responses and config
      const normalize = (name?: string): string => {
        const n = (name || "").toLowerCase();
        return n === "signet" ? "testnet4" : n;
      };
      const connectedNetwork = normalize(res.result?.bitcoin?.name);
      const isCorrect = normalize(expectedNetwork) === connectedNetwork;

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

          // Load local transactions when the wallet is already connected
          get().loadLocalTransactions();
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
      const bestProvider = await getPreferredWeb3ProviderAsync();
      if (!bestProvider) {
        console.warn("Wallet provider not found");
        return;
      }

      const { VIA_NETWORK_CONFIG, BRIDGE_CONFIG } = await import("@/services/config");
      const expectedChainId = VIA_NETWORK_CONFIG[BRIDGE_CONFIG.defaultNetwork].chainId;
      const chainId = await bestProvider.provider.request({ method: 'eth_chainId' }) as string;
      const isCorrect = chainId === expectedChainId;

      set({ isCorrectViaNetwork: isCorrect, chainId: chainId });

      // AUTO-SWITCH REMOVED: Do not force switch here. Let the UI handle "Wrong Network" state.
    } catch (error) {
      console.error("Error checking wallet network:", error);
    }
  },

  checkL1Network: async () => {
    try {
      const bestProvider = await getPreferredWeb3ProviderAsync();
      if (!bestProvider) return;

      // Sepolia Chain ID
      const expectedChainId = "0xaa36a7"; // 11155111
      const chainId = await bestProvider.provider.request({ method: 'eth_chainId' }) as string;
      const isCorrect = chainId.toLowerCase() === expectedChainId.toLowerCase();

      set({ isCorrectL1Network: isCorrect, chainId: chainId });
    } catch (error) {
      console.error("Error checking L1 network:", error);
    }
  },

  connectL1Wallet: async () => {
    try {
      const { isMetamaskConnected, viaAddress } = get();
      
      // If already connected to MetaMask, use existing connection
      if (isMetamaskConnected && viaAddress) {
        console.log("🔹 Wallet already connected, switching to Sepolia...");
        set({
          l1Address: viaAddress,
          isL1Connected: true
        });
      } else {
        console.log("🔹 Connecting L1 wallet and switching to Sepolia...");
        const bestProvider = await getPreferredWeb3ProviderAsync();
        if (!bestProvider) throw new Error("No wallet found");

        // Step 1: Request account connection
        const accounts = await bestProvider.provider.request({
          method: "eth_requestAccounts",
        }) as string[];

        if (!accounts || accounts.length === 0) {
          throw new Error("No accounts returned from wallet");
        }

        const address = accounts[0];
        set({
          l1Address: address,
          isL1Connected: true
        });
      }

      // Step 2: Automatically switch to Sepolia network
      console.log("🔄 Switching to Sepolia network...");
      const networkResult = await switchToEthereumNetwork(EthereumNetwork.SEPOLIA);
      
      if (networkResult.success) {
        set({ isCorrectL1Network: true });
        console.log("✅ Connected to L1 wallet and switched to Sepolia");
        walletEvents.networkChanged.emit();
      } else {
        // If switch failed, still mark as connected but network is incorrect
        // User will see a warning but can proceed
        console.warn("⚠️ Connected but network switch failed:", networkResult.error);
        await get().checkL1Network();
      }

      // Load local transactions after connecting
      get().loadLocalTransactions();

      return true;
    } catch (error: any) {
      console.error("L1 Connect error:", error);
      const USER_REJECTION_ERROR_CODE = 4001;
      if (error.code === USER_REJECTION_ERROR_CODE) {
        console.log("Connection rejected by user");
        return false;
      }
      throw error;
    }
  }
}));
