"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import DepositForm from "@/components/deposit-form";
import WithdrawForm from "@/components/withdraw-form";
import WalletConnectButton from "@/components/wallet-connect-button";
import { useWalletState } from "@/hooks/use-wallet-state";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { Layer } from "@/services/config";
import { walletEvents } from "@/store/wallet-store";

export default function BridgeInterface() {
  const [activeTab, setActiveTab] = useState<string>("deposit");
  const [refreshKey, setRefreshKey] = useState(0);
  const {
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
  } = useWalletState();

  // Listen for wallet events to refresh the UI
  useEffect(() => {
    const unsubscribers = [
      walletEvents.metamaskConnected.on(() => setRefreshKey(prev => prev + 1)),
      walletEvents.xverseConnected.on(() => setRefreshKey(prev => prev + 1)),
      walletEvents.metamaskDisconnected.on(() => setRefreshKey(prev => prev + 1)),
      walletEvents.xverseDisconnected.on(() => setRefreshKey(prev => prev + 1)),
      walletEvents.networkChanged.on(() => setRefreshKey(prev => prev + 1)),
    ];

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  // Connect to appropriate wallet based on active tab
  useEffect(() => {
    if (activeTab === "deposit" && !isXverseConnected) {
      // Optional auto-connect logic
    } else if (activeTab === "withdraw" && !isMetamaskConnected) {
      // Option al auto-connect logic
    }
  }, [activeTab, isXverseConnected, isMetamaskConnected]);

  return (
    <div className="flex flex-col items-center" key={refreshKey}>
      <Card className="w-full max-w-md shadow-lg bg-white border-border/50">
        {/* <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl font-bold tracking-tight text-slate-900">
            Bridge BTC
          </CardTitle>
          <CardDescription className="text-sm text-slate-600">
            Transfer BTC between Bitcoin and VIA network
          </CardDescription>
        </CardHeader> */}
        <CardContent>
          {/* {(isXverseConnected) && (!isCorrectBitcoinNetwork) && <NetworkWarning layer={Layer.L1} />} */}
          {/* {(isMetamaskConnected) && (!isCorrectViaNetwork) && <NetworkWarning layer={Layer.L2} />} */}
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
                isCorrectBitcoinNetwork ? (
                  <DepositForm
                    bitcoinAddress={bitcoinAddress}
                    bitcoinPublicKey={bitcoinPublicKey}
                    onDisconnect={disconnectXverse}
                  />
                ) : (
                  <div className="flex flex-col items-center space-y-4 py-6">
                    <AlertCircle className="h-12 w-12 text-amber-500" />
                    <h3 className="text-lg font-semibold">Wrong Network</h3>
                    <p className="text-sm text-center text-muted-foreground max-w-[280px]">
                      Please switch to the correct Bitcoin network to continue.
                    </p>
                    <Button onClick={() => switchNetwork(Layer.L2)}>Switch Network</Button>
                  </div>
                )
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
                isCorrectViaNetwork ? (
                  <WithdrawForm viaAddress={viaAddress} />
                ) : (
                  <div className="flex flex-col items-center space-y-4 py-6">
                    <AlertCircle className="h-12 w-12 text-amber-500" />
                    <h3 className="text-lg font-semibold">Wrong Network</h3>
                    <p className="text-sm text-center text-muted-foreground max-w-[280px]">
                      Please switch to the VIA network to continue.
                    </p>
                    <Button onClick={() => switchNetwork(Layer.L2)}>Switch Network</Button>
                  </div>
                )
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
