import { create } from 'zustand';
import { Layer } from '@/services/config';
import { createEvent } from "@/utils/events";
import { getMetaMaskProvider } from "@/utils/ethereum-provider";
import { getAllWalletProviders, getCoinbaseProvider, getRabbyProvider } from "@/utils/ethereum-provider";
import { createWalletError, WalletNotFoundError } from "@/utils/wallet-errors";

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

interface WalletState {
  bitcoinAddress: string | null;
  bitcoinPublicKey: string | null;
  viaAddress: string | null;
  isXverseConnected: boolean;
  isMetamaskConnected: boolean;
  isCorrectBitcoinNetwork: boolean;
  isCorrectViaNetwork: boolean;

  // Multi wallet support
  availableWallets: Array<{name: string, rdns: string, icon?: string}>;
  selectedWallet: string | null; // rdns of selected wallet

  // Actions
  setBitcoinAddress: (address: string | null) => void;
  setBitcoinPublicKey: (publicKey: string | null) => void;
  setViaAddress: (address: string | null) => void;
  setIsXverseConnected: (connected: boolean) => void;
  setIsMetamaskConnected: (connected: boolean) => void;
  setIsCorrectBitcoinNetwork: (correct: boolean) => void;
  setIsCorrectViaNetwork: (correct: boolean) => void;

  setAvailableWallets: (wallets: Array<{name: string, rdns: string, icon?: string}>) => void;
  setSelectedWallet: (rdns: string) => void;

  // Wallet operations
  connectXverse: () => Promise<boolean>;
  connectMetamask: () => Promise<boolean>;
  disconnectXverse: () => void;
  disconnectMetamask: () => void;
  switchNetwork: (layer: Layer) => void;

  connectWallet: (rdns: string) => Promise<boolean>;
  refreshAvailableWallets: () => void;

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

  availableWallets: [],
  selectedWallet: null,

  // Setters
  setBitcoinAddress: (address) => set({ bitcoinAddress: address }),
  setBitcoinPublicKey: (publicKey) => set({ bitcoinPublicKey: publicKey }),
  setViaAddress: (address) => set({ viaAddress: address }),
  setIsXverseConnected: (connected) => set({ isXverseConnected: connected }),
  setIsMetamaskConnected: (connected) => set({ isMetamaskConnected: connected }),
  setIsCorrectBitcoinNetwork: (correct) => set({ isCorrectBitcoinNetwork: correct }),
  setIsCorrectViaNetwork: (correct) => set({ isCorrectViaNetwork: correct }),

  setAvailableWallets: (wallets) => set({ availableWallets: wallets }),
  setSelectedWallet: (rdns) => set({ selectedWallet: rdns }),

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

  connectWallet: async (rdns: string) => {
    try {
      console.log(`🔹 Connecting to wallet with rdns: ${rdns}`);
      
      const { eip6963Store } = await import("@/utils/eip6963-provider");
      const providerDetail = eip6963Store.getProviderByRdns(rdns);
      
      if (!providerDetail) {
        throw new WalletNotFoundError(`Wallet with rdns ${rdns} not found`);
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
        selectedWallet: rdns
      });

      // Check network after connection
      await get().checkMetamaskNetwork();

      console.log(`✅ Wallet ${providerDetail.info.name} connected, address:`, address);
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
    
    const { eip6963Store } = require("@/utils/eip6963-provider");
    const providers = eip6963Store.getAllWalletProviders();
    
    const wallets = providers.map((provider: EIP6963ProviderDetail) => ({
      name: provider.info.name,
      rdns: provider.info.rdns,
      icon: provider.info.icon
    }));

    set({ availableWallets: wallets });
    
    console.log(`✅ Found ${wallets.length} available wallets:`, wallets);
    walletEvents.walletRefreshed.emit();
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

