"use client";

import { useEffect } from "react";
import { useWalletStore } from "@/store/wallet-store";
import { getPreferredWeb3Provider } from "@/utils/ethereum-provider";

export function useWalletState() {
  const walletStore = useWalletStore();
  
  // Check network and connection status on mount
  useEffect(() => {
    async function checkConnections() {
      await walletStore.checkXverseConnection();
      await walletStore.checkMetamaskNetwork();
    }

    checkConnections();
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

  // Listen for metmask account and network changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const bestProvider = getPreferredWeb3Provider();
    if (!bestProvider) {
      console.log('Wallet not available for account change monitoring');
      return;
    }
    const provider = bestProvider.provider;

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('MetaMask accounts changed:', accounts);
      
      if (accounts.length === 0) {
        console.log('MetaMask disconnected or locked');
        walletStore.disconnectMetamask();
      } else {
        console.log('Active account:', accounts[0]);
        
        walletStore.setViaAddress(accounts[0]);
        if (!walletStore.isMetamaskConnected) {
          walletStore.setIsMetamaskConnected(true);
        }
        
        walletStore.checkMetamaskNetwork();
      }
    };

    const handleChainChanged = async (chainId: string) => {
      console.log('MetaMask chain changed to:', chainId);
      // check if we're on the correct network
      await walletStore.checkMetamaskNetwork();
    };


    if (provider.on) {
      provider.on('accountsChanged', handleAccountsChanged);
      provider.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (provider.removeListener) {
        provider.removeListener('accountsChanged', handleAccountsChanged);
        provider.removeListener('chainChanged', handleChainChanged);
      }
    };
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
