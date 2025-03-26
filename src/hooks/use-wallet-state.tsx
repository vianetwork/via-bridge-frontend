"use client"

import { useState, useCallback } from "react"
import { getAddress } from "sats-connect"

interface WalletState {
  bitcoinAddress: string | null
  viaAddress: string | null
  isXverseConnected: boolean
  isMetamaskConnected: boolean
  connectXverse: () => Promise<void>
  connectMetamask: () => Promise<void>
  disconnectXverse: () => void
  disconnectMetamask: () => void
}

export function useWalletState(): WalletState {
  const [bitcoinAddress, setBitcoinAddress] = useState<string | null>(null)
  const [viaAddress, setViaAddress] = useState<string | null>(null)
  const [isXverseConnected, setIsXverseConnected] = useState(false)
  const [isMetamaskConnected, setIsMetamaskConnected] = useState(false)

  const connectXverse = useCallback(async () => {
    try {
      // Check if window.bitcoin exists (Xverse wallet)
      if (typeof window !== "undefined" && "bitcoin" in window) {
        const getAddressOptions = {
          payload: {
            purposes: ["payment"],
            message: "Connect to VIA Bridge",
            network: {
              type: "Mainnet",
            },
          },
          onFinish: (response: any) => {
            const address = response.addresses[0].address
            setBitcoinAddress(address)
            setIsXverseConnected(true)
            console.log("Xverse connected:", address)
          },
          onCancel: () => {
            throw new Error("User canceled Xverse connection")
          },
        }

        // @ts-ignore - sats-connect types
        await getAddress(getAddressOptions)
      } else {
        // For development/testing, use a mock address
        const mockAddress = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
        setBitcoinAddress(mockAddress)
        setIsXverseConnected(true)
        console.log("Mock Xverse connected:", mockAddress)
      }
    } catch (error) {
      console.error("Xverse connection error:", error)
      throw error
    }
  }, [])

  const connectMetamask = useCallback(async () => {
    try {
      // Check if window.ethereum exists (MetaMask)
      if (typeof window !== "undefined" && window.ethereum) {
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        })
        const address = accounts[0]
        setViaAddress(address)
        setIsMetamaskConnected(true)
        console.log("MetaMask connected:", address)
      } else {
        // For development/testing, use a mock address
        const mockAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e"
        setViaAddress(mockAddress)
        setIsMetamaskConnected(true)
        console.log("Mock MetaMask connected:", mockAddress)
      }
    } catch (error) {
      console.error("MetaMask connection error:", error)
      throw error
    }
  }, [])

  const disconnectXverse = useCallback(() => {
    setBitcoinAddress(null)
    setIsXverseConnected(false)
  }, [])

  const disconnectMetamask = useCallback(() => {
    setViaAddress(null)
    setIsMetamaskConnected(false)
  }, [])

  return {
    bitcoinAddress,
    viaAddress,
    isXverseConnected,
    isMetamaskConnected,
    connectXverse,
    connectMetamask,
    disconnectXverse,
    disconnectMetamask,
  }
}
