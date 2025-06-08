"use client";

import { useEffect } from "react";
import { useWalletStore } from "@/store/wallet-store";
import { setupEthereumListeners } from "@/utils/ethereum-provider";

export function useWalletState() {
  const walletStore = useWalletStore();
  
  // Check network and connection status on mount
  useEffect(() => {
    async function checkConnections() {
      await walletStore.checkXverseConnection();
      await walletStore.checkMetamaskNetwork();
    }

    checkConnections();

    // Set up MetaMask network change listener using safer provider detection
    const handleChainChanged = () => {
      walletStore.checkMetamaskNetwork();
    };

    const cleanupEthereumListener = setupEthereumListeners('chainChanged', handleChainChanged);

    // Clean up listener on unmount
    return () => {
      if (cleanupEthereumListener) {
        cleanupEthereumListener();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up Xverse wallet event listeners
  useEffect(() => {
    const setupXverseListeners = async () => {
      try {
        const { addListener } = await import("sats-connect");

        // Listen for network changes
        const handleNetworkChange = () => {
          console.log("Xverse network changed");
          walletStore.checkXverseConnection();
        };

        // Listen for connection status changes
        const handleConnectionChange = (connected: boolean) => {
          console.log("Xverse connection changed:", connected);
          if (connected) {
            walletStore.checkXverseConnection();
          } else {
            walletStore.setIsXverseConnected(false);
            walletStore.setBitcoinAddress(null);
            walletStore.setBitcoinPublicKey(null);
            walletStore.setIsCorrectBitcoinNetwork(false);
          }
        };

        const networkChangeListener = addListener('networkChange', () => {
          handleNetworkChange();
        });

        const disconnectListener = addListener('disconnect', () => {
          handleConnectionChange(false);
        });

        // Clean up listeners on unmount
        return () => {
          networkChangeListener();
          disconnectListener();
        };
      } catch (error) {
        console.error("Failed to set up Xverse event listeners:", error);
      }
    };

    setupXverseListeners();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    bitcoinAddress: walletStore.bitcoinAddress,
    bitcoinPublicKey: walletStore.bitcoinPublicKey,
    viaAddress: walletStore.viaAddress,
    isXverseConnected: walletStore.isXverseConnected,
    isMetamaskConnected: walletStore.isMetamaskConnected,
    isCorrectBitcoinNetwork: walletStore.isCorrectBitcoinNetwork,
    isCorrectViaNetwork: walletStore.isCorrectViaNetwork,
    connectXverse: walletStore.connectXverse,
    connectMetamask: walletStore.connectMetamask,
    disconnectXverse: walletStore.disconnectXverse,
    disconnectMetamask: walletStore.disconnectMetamask,
    switchNetwork: walletStore.switchNetwork,
  };
}
