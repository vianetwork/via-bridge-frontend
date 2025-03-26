"use client"

import { Button } from "@/components/ui/button"
import { Loader2, Wallet } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import Image from "next/image"

interface WalletConnectButtonProps {
  walletType: "xverse" | "metamask"
  isConnected: boolean
  onConnect: () => Promise<void>
  onDisconnect: () => void
}

export default function WalletConnectButton({
  walletType,
  isConnected,
  onConnect,
  onDisconnect,
}: WalletConnectButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = async () => {
    try {
      setIsConnecting(true)
      await onConnect()
      toast.success("Wallet connected", {
        description: `Successfully connected to ${walletType === "xverse" ? "Xverse" : "MetaMask"}.`,
      })
    } catch (error) {
      console.error(`${walletType} connection error:`, error)
      toast.error("Connection failed", {
        description: `Failed to connect to ${walletType === "xverse" ? "Xverse" : "MetaMask"}. Please try again.`,
      })
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = () => {
    onDisconnect()
    toast.success("Wallet disconnected", {
      description: `Successfully disconnected from ${walletType === "xverse" ? "Xverse" : "MetaMask"}.`,
    })
  }

  const walletName = walletType === "xverse" ? "Xverse" : "MetaMask"

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-border/50 backdrop-blur-sm">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
        <div className="relative rounded-full bg-gradient-to-br from-primary/10 to-primary/5 p-4 ring-1 ring-primary/20">
          {walletType === "xverse" ? (
            <Image 
              src="/xverse-logo.svg" 
              alt="Xverse" 
              width={32} 
              height={32} 
              priority
            />
          ) : (
            <Image 
              src="/metamask-logo.svg" 
              alt="MetaMask" 
              width={32} 
              height={32} 
              priority
            />
          )}
        </div>
      </div>
      
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">Connect {walletName}</h3>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          {walletType === "xverse"
            ? "Connect your Xverse wallet to deposit BTC to VIA"
            : "Connect MetaMask to withdraw from VIA to BTC"}
        </p>
      </div>

      <Button
        onClick={isConnected ? handleDisconnect : handleConnect}
        variant={isConnected ? "outline" : "default"}
        className="w-full h-11 text-base font-medium shadow-sm hover:shadow-md transition-all duration-200"
        disabled={isConnecting}
      >
        {isConnecting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Connecting...
          </>
        ) : isConnected ? (
          "Disconnect Wallet"
        ) : (
          `Connect ${walletName}`
        )}
      </Button>
    </div>
  )
}
