"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import DepositForm from "@/components/deposit-form"
import WithdrawForm from "@/components/withdraw-form"
import WalletConnectButton from "@/components/wallet-connect-button"
import { useWalletState } from "@/hooks/use-wallet-state"
import { useMobile } from "@/hooks/use-mobile"

export default function BridgeInterface() {
  const { isMobile } = useMobile()
  const [activeTab, setActiveTab] = useState<string>("deposit")
  const {
    bitcoinAddress,
    viaAddress,
    isXverseConnected,
    isMetamaskConnected,
    connectXverse,
    connectMetamask,
    disconnectXverse,
    disconnectMetamask,
  } = useWalletState()

  // Connect to appropriate wallet based on active tab
  useEffect(() => {
    if (activeTab === "deposit" && !isXverseConnected) {
      // Optional auto-connect logic
    } else if (activeTab === "withdraw" && !isMetamaskConnected) {
      // Optional auto-connect logic
    }
  }, [activeTab, isXverseConnected, isMetamaskConnected])

  return (
    <div className="flex flex-col items-center">
      <Card className="w-full max-w-md shadow-2xl hover:shadow-3xl transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-slate-900 border-border/50">
        <CardHeader className="space-y-2 pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Bridge BTC
          </CardTitle>
          <CardDescription className="text-sm text-slate-600 dark:text-slate-300">
            Transfer BTC between Bitcoin and VIA blockchain
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="deposit" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 h-14 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <TabsTrigger 
                value="deposit" 
                className="text-base font-medium rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-200 hover:bg-white/80 dark:hover:bg-slate-800/80"
              >
                Deposit
              </TabsTrigger>
              <TabsTrigger 
                value="withdraw" 
                className="text-base font-medium rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-200 hover:bg-white/80 dark:hover:bg-slate-800/80"
              >
                Withdraw
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deposit">
              {isXverseConnected ? (
                <DepositForm bitcoinAddress={bitcoinAddress} />
              ) : (
                <WalletConnectButton
                  walletType="xverse"
                  isConnected={isXverseConnected}
                  onConnect={connectXverse}
                  onDisconnect={disconnectXverse}
                />
              )}
            </TabsContent>

            <TabsContent value="withdraw">
              {isMetamaskConnected ? (
                <WithdrawForm viaAddress={viaAddress} />
              ) : (
                <WalletConnectButton
                  walletType="metamask"
                  isConnected={isMetamaskConnected}
                  onConnect={connectMetamask}
                  onDisconnect={disconnectMetamask}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
