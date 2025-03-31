"use client";

import { useState, useCallback } from "react";

interface WalletState {
  bitcoinAddress: string | null
  bitcoinPublicKey: string | null
  viaAddress: string | null
  isXverseConnected: boolean
  isMetamaskConnected: boolean
  connectXverse: () => Promise<boolean>
  connectMetamask: () => Promise<boolean>
  disconnectXverse: () => void
  disconnectMetamask: () => void
}

export function useWalletState(): WalletState {
  const [bitcoinAddress, setBitcoinAddress] = useState<string | null>(null);
  const [bitcoinPublicKey, setBitcoinPublicKey] = useState<string | null>(null);
  const [viaAddress, setViaAddress] = useState<string | null>(null);
  const [isXverseConnected, setIsXverseConnected] = useState(false);
  const [isMetamaskConnected, setIsMetamaskConnected] = useState(false);

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

  const disconnectXverse = useCallback(() => {
    setBitcoinAddress(null);
    setBitcoinPublicKey(null);
    setIsXverseConnected(false);
  }, []);

  const disconnectMetamask = useCallback(() => {
    setViaAddress(null);
    setIsMetamaskConnected(false);
  }, []);

  return {
    bitcoinAddress,
    bitcoinPublicKey,
    viaAddress,
    isXverseConnected,
    isMetamaskConnected,
    connectXverse,
    connectMetamask,
    disconnectXverse,
    disconnectMetamask,
  };
}
