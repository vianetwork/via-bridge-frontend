"use client";

import { useState, useCallback, useEffect } from "react";
import { BRIDGE_CONFIG, Layer, VIA_NETWORK_CONFIG } from "@/services/config";
import { WalletType } from "sats-connect";

interface WalletState {
  bitcoinAddress: string | null
  bitcoinPublicKey: string | null
  viaAddress: string | null
  isXverseConnected: boolean
  isMetamaskConnected: boolean
  isCorrectBitcoinNetwork: boolean
  isCorrectViaNetwork: boolean
  connectXverse: () => Promise<boolean>
  connectMetamask: () => Promise<boolean>
  disconnectXverse: () => void
  disconnectMetamask: () => void
  switchNetwork: (layer: Layer) => void
}

export function useWalletState(): WalletState {
  const [bitcoinAddress, setBitcoinAddress] = useState<string | null>(null);
  const [bitcoinPublicKey, setBitcoinPublicKey] = useState<string | null>(null);
  const [viaAddress, setViaAddress] = useState<string | null>(null);
  const [isXverseConnected, setIsXverseConnected] = useState(false);
  const [isMetamaskConnected, setIsMetamaskConnected] = useState(false);
  const [isCorrectBitcoinNetwork, setIsCorrectBitcoinNetwork] = useState(false);
  const [isCorrectViaNetwork, setIsCorrectViaNetwork] = useState(false);

  // Check network and connection status on mount
  useEffect(() => {
    async function checkConnections() {
      await checkXverseConnection();
      await checkMetamaskNetwork();
    }

    checkConnections();

    // Set up MetaMask network change listener
    if (typeof window !== "undefined" && window.ethereum) {
      const handleChainChanged = (chainId: string) => {
        console.log("MetaMask network changed:", chainId);
        checkMetamaskNetwork();
      };

      window.ethereum.on('chainChanged', handleChainChanged);

      // Clean up listener on unmount
      return () => {
        window.ethereum?.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

  // Set up Xverse wallet event listeners
  useEffect(() => {
    const setupXverseListeners = async () => {
      try {
        const { addListener } = await import("sats-connect");

        // Listen for network changes
        const handleNetworkChange = () => {
          console.log("Xverse network changed");
          checkXverseConnection();
        };

        // Listen for connection status changes
        const handleConnectionChange = (connected: boolean) => {
          console.log("Xverse connection changed:", connected);
          if (connected) {
            checkXverseConnection();
          } else {
            setIsXverseConnected(false);
            setBitcoinAddress(null);
            setBitcoinPublicKey(null);
            setIsCorrectBitcoinNetwork(false);
          }
        };

        const networkChangeListener = addListener('networkChange', (event) => {
          handleNetworkChange()
        })

        const disconnectListener = addListener('disconnect', (event) => {
          handleConnectionChange(false)
        })

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
  }, []);

  // Check Xverse connection status
  async function checkXverseConnection() {
    try {
      const { request, AddressPurpose } = await import("sats-connect");

      const res = await request('wallet_getNetwork', null) as any;
      if (!res.status) {
        setIsXverseConnected(false);
        return;
      }

      // Check if connected to the correct network
      const expectedNetwork = BRIDGE_CONFIG.defaultNetwork;
      const connectedNetwork = res.result.bitcoin.name.toLowerCase();
      const isCorrect = expectedNetwork == connectedNetwork;

      setIsCorrectBitcoinNetwork(isCorrect);

      const response = await request("getAddresses", {
        purposes: [AddressPurpose.Payment],
      });

      if (response.status === "success") {
        const connectedPaymentAddress = response.result.addresses.find(
          (address) => address.purpose === AddressPurpose.Payment
        );

        if (connectedPaymentAddress) {
          setBitcoinAddress(connectedPaymentAddress.address);
          setBitcoinPublicKey(connectedPaymentAddress.publicKey);
          setIsXverseConnected(true);
          console.log("✅ Xverse wallet already connected");
        }
      }
    } catch (error) {
      // Silently handle error - wallet is not connected
      setIsXverseConnected(false);
    }
  }

  // Check MetaMask network
  async function checkMetamaskNetwork() {
    try {
      console.log(window.ethereum)
      const expectedChainId = VIA_NETWORK_CONFIG[BRIDGE_CONFIG.defaultNetwork].chainId;
      const chainId = await window.ethereum?.request({ method: 'eth_chainId' });
      const isCorrect = chainId == expectedChainId;

      console.log("AAAAAAAAAAAAAAAAAAAAAAAAAAAA", isCorrect)
      if (!isCorrect) {
        console.log("BBBBBBBBBBBBBBBBBBBBBBBBB")
        try {
          await window.ethereum?.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: expectedChainId }],
          });
          setIsCorrectBitcoinNetwork(true);
          return true;
        } catch (switchError: any) {
          // This error code indicates that the chain has not been added to MetaMask
          if (switchError.code === 4902) {
            // await window.ethereum?.request({
            //   method: 'wallet_addEthereumChain',
            //   params: [VIA_NETWORK_CONFIG[BRIDGE_CONFIG.defaultNetwork]],
            // });
            setIsCorrectBitcoinNetwork(true);
            return true;
          }
          throw switchError;
        }
      }
      setIsCorrectViaNetwork(isCorrect);
    } catch (error) {
      console.error("Error checking MetaMask network:", error);
    }
  }

  const switchNetwork = useCallback(async (layer: Layer) => {
    try {
      switch (layer) {
        case Layer.L1:
          // For Xverse, we need to disconnect and reconnect
          if (isXverseConnected) {
            await disconnectXverse();
            return await connectXverse();
          }
        case Layer.L2:
          if (isMetamaskConnected) {
            // For MetaMask, we can request network switch
            if (typeof window === "undefined" || !window.ethereum) {
              throw new Error("MetaMask not found");
            }

            const expectedChainId = VIA_NETWORK_CONFIG[BRIDGE_CONFIG.defaultNetwork].chainId;
            try {
              await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: expectedChainId }],
              });
              setIsCorrectBitcoinNetwork(true);
              return true;
            } catch (switchError: any) {
              // This error code indicates that the chain has not been added to MetaMask
              if (switchError.code === 4902) {
                await window.ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [VIA_NETWORK_CONFIG[BRIDGE_CONFIG.defaultNetwork]],
                });
                setIsCorrectBitcoinNetwork(true);
                return true;
              }
              throw switchError;
            }
          }

      }
    } catch (error) {
      console.error("Network switch error:", error);

    }
  }, [isXverseConnected, isMetamaskConnected]);

  const connectXverse = useCallback(async () => {
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

      setBitcoinAddress(addresses[0].address);
      setBitcoinPublicKey(addresses[0].publicKey);
      setIsXverseConnected(true);

      // Check network after connection
      await checkXverseConnection();

      console.log("✅ Xverse wallet connected, addresses:", addresses);
      return true;
    } catch (error) {
      console.error("Xverse connection error:", error);
      throw error;
    }
  }, []);

  const connectMetamask = useCallback(async () => {
    try {
      if (typeof window === "undefined" || !window.ethereum) {
        throw new Error("MetaMask not found. Please install MetaMask extension.");
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const address = accounts[0];
      setViaAddress(address);
      setIsMetamaskConnected(true);

      // Check network after connection
      await checkMetamaskNetwork();

      console.log("✅ MetaMask wallet connected, address:", address);
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
  }, []);

  const disconnectXverse = useCallback(async () => {
    try {
      const { request } = await import("sats-connect");
      await request("wallet_disconnect", null);
    } catch (error) {
      console.error("Xverse disconnect error:", error);
    } finally {
      setBitcoinAddress(null);
      setBitcoinPublicKey(null);
      setIsXverseConnected(false);
      setIsCorrectBitcoinNetwork(false);
    }
  }, []);

  const disconnectMetamask = useCallback(() => {
    setViaAddress(null);
    setIsMetamaskConnected(false);
    setIsCorrectBitcoinNetwork(false);
  }, []);

  return {
    bitcoinAddress,
    bitcoinPublicKey,
    viaAddress,
    isXverseConnected,
    isMetamaskConnected,
    isCorrectBitcoinNetwork,
    isCorrectViaNetwork,
    connectXverse,
    connectMetamask,
    disconnectXverse,
    disconnectMetamask,
    switchNetwork,
  };
}
