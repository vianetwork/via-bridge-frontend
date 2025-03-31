"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DepositForm from "@/components/deposit-form";
import WithdrawForm from "@/components/withdraw-form";
import WalletConnectButton from "@/components/wallet-connect-button";
import { useWalletState } from "@/hooks/use-wallet-state";

export default function BridgeInterface() {
  const [activeTab, setActiveTab] = useState<string>("deposit");
  const {
    bitcoinAddress,
    bitcoinPublicKey,
    viaAddress,
    isXverseConnected,
    isMetamaskConnected,
    connectXverse,
    connectMetamask,
    disconnectXverse,
    disconnectMetamask,
  } = useWalletState();

  // Connect to appropriate wallet based on active tab
  useEffect(() => {
    if (activeTab === "deposit" && !isXverseConnected) {
      // Optional auto-connect logic
    } else if (activeTab === "withdraw" && !isMetamaskConnected) {
      // Optional auto-connect logic
    }
  }, [activeTab, isXverseConnected, isMetamaskConnected]);

  return (
    <div className="flex flex-col items-center">
      <Card className="w-full max-w-md shadow-2xl bg-white border-border/50">
        <CardHeader className="space-y-2 pb-6">
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900">
            Bridge BTC
          </CardTitle>
          <CardDescription className="text-sm text-slate-600">
            Transfer BTC between Bitcoin and VIA networks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="deposit" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 h-10 bg-slate-100 p-1 rounded-xl">
              <TabsTrigger 
                value="deposit" 
                className="text-sm font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-200 hover:bg-white/80"
              >
                Deposit
              </TabsTrigger>
              <TabsTrigger 
                value="withdraw" 
                className="text-sm font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-200 hover:bg-white/80"
              >
                Withdraw
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deposit">
              {isXverseConnected ? (
                <DepositForm bitcoinAddress={bitcoinAddress} bitcoinPublicKey={bitcoinPublicKey} />
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
  );
}
