import { create } from 'zustand';
import { Layer } from '@/services/config';
import { createEvent } from "@/utils/events";

// Create events for wallet state changes
export const walletEvents = {
  metamaskConnected: createEvent<void>('metamask-connected'),
  xverseConnected: createEvent<void>('xverse-connected'),
  metamaskDisconnected: createEvent<void>('metamask-disconnected'),
  xverseDisconnected: createEvent<void>('xverse-disconnected'),
  networkChanged: createEvent<void>('network-changed'),
};

interface WalletState {
  bitcoinAddress: string | null;
  bitcoinPublicKey: string | null;
  viaAddress: string | null;
  isXverseConnected: boolean;
  isMetamaskConnected: boolean;
  isCorrectBitcoinNetwork: boolean;
  isCorrectViaNetwork: boolean;

  // Actions
  setBitcoinAddress: (address: string | null) => void;
  setBitcoinPublicKey: (publicKey: string | null) => void;
  setViaAddress: (address: string | null) => void;
  setIsXverseConnected: (connected: boolean) => void;
  setIsMetamaskConnected: (connected: boolean) => void;
  setIsCorrectBitcoinNetwork: (correct: boolean) => void;
  setIsCorrectViaNetwork: (correct: boolean) => void;

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

  // Setters
  setBitcoinAddress: (address) => set({ bitcoinAddress: address }),
  setBitcoinPublicKey: (publicKey) => set({ bitcoinPublicKey: publicKey }),
  setViaAddress: (address) => set({ viaAddress: address }),
  setIsXverseConnected: (connected) => set({ isXverseConnected: connected }),
  setIsMetamaskConnected: (connected) => set({ isMetamaskConnected: connected }),
  setIsCorrectBitcoinNetwork: (correct) => set({ isCorrectBitcoinNetwork: correct }),
  setIsCorrectViaNetwork: (correct) => set({ isCorrectViaNetwork: correct }),

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
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask not found. Please install MetaMask extension.");
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

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
            if (typeof window === "undefined" || !window.ethereum) {
              throw new Error("MetaMask not found");
            }

            const { VIA_NETWORK_CONFIG, BRIDGE_CONFIG } = await import("@/services/config");
            const expectedChainId = VIA_NETWORK_CONFIG[BRIDGE_CONFIG.defaultNetwork].chainId;

            try {
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: expectedChainId }],
              });
              set({ isCorrectViaNetwork: true });
              return true;
            } catch (switchError: any) {
              // This error code indicates that the chain has not been added to MetaMask
              if (switchError.code === 4902) {
                await window.ethereum.request({
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
      if (typeof window === "undefined" || !window.ethereum) return;

      const { VIA_NETWORK_CONFIG, BRIDGE_CONFIG } = await import("@/services/config");
      const expectedChainId = VIA_NETWORK_CONFIG[BRIDGE_CONFIG.defaultNetwork].chainId;
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const isCorrect = chainId === expectedChainId;

      set({ isCorrectViaNetwork: isCorrect });

      if (!isCorrect) {
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: expectedChainId }],
          });
          set({ isCorrectViaNetwork: true });
          return true;
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            await window.ethereum.request({
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
