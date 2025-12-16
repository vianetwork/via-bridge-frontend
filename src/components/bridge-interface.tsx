"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import DepositForm from "@/components/deposit-form";
import WithdrawForm from "@/components/withdraw-form";
import WalletConnectButton from "@/components/wallet-connect-button";
import { useWalletState } from "@/hooks/use-wallet-state";
import { Button } from "@/components/ui/button";
import { AlertCircle, ChevronDown, ChevronUp, Clock, Loader2 } from "lucide-react";
import { walletEvents, useWalletStore } from "@/store/wallet-store";
import { TransactionHistory } from "@/components/transaction-history";
import { useNetworkSwitcher } from "@/hooks/use-network-switcher";

export default function BridgeInterface() {
  const [activeTab, setActiveTab] = useState<string>("deposit");
  // const [refreshKey, setRefreshKey] = useState(0);
  const [showTransactions, setShowTransactions] = useState(false);

  const {
    btcTransactions,
    isLoadingTransactions,
    fetchBtcTransactions
  } = useWalletStore();

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
  } = useWalletState();

  const { switchToL1, switchToL2, isSwitching: isSwitchingNetwork, status: networkStatus } = useNetworkSwitcher();
  const { checkXverseConnection, checkMetamaskNetwork } = useWalletStore();
  const [isAutoSwitching, setIsAutoSwitching] = useState(false);
  const [autoSwitchFailed, setAutoSwitchFailed] = useState(false);

  // Check if any wallet is connected
  const isBothWalletConnected = isXverseConnected && isMetamaskConnected;

  // Fetch transactions when wallets are connected
  useEffect(() => {
    if (isBothWalletConnected) {
      fetchBtcTransactions();
    }
  }, [isBothWalletConnected, fetchBtcTransactions]);

  // Set up a polling interval to refresh transactions
  useEffect(() => {
    if (!isBothWalletConnected) return;

    const interval = setInterval(() => {
      fetchBtcTransactions();
    }, 300000); // Refresh every 10 minutes

    return () => clearInterval(interval);
  }, [isBothWalletConnected, fetchBtcTransactions]);

  // Listen for wallet events to refresh the UI and transactions
  useEffect(() => {
    const unsubscribers = [
      walletEvents.metamaskConnected.on(() => {
        // setRefreshKey(prev => prev + 1);
        fetchBtcTransactions();
      }),
      walletEvents.xverseConnected.on(() => {
        // setRefreshKey(prev => prev + 1);
        fetchBtcTransactions();
      }),
      // walletEvents.metamaskDisconnected.on(() => setRefreshKey(prev => prev + 1)),
      // walletEvents.xverseDisconnected.on(() => setRefreshKey(prev => prev + 1)),
      walletEvents.networkChanged.on(() => {
        // setRefreshKey(prev => prev + 1);
        fetchBtcTransactions();
      }),
    ];

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [fetchBtcTransactions]);

  // Auto-switch network based on active tab
  useEffect(() => {
    const autoSwitchNetwork = async () => {
      // For deposit tab: need Bitcoin network
      if (activeTab === "deposit") {
        if (!isXverseConnected) {
          setAutoSwitchFailed(false);
          return;
        }
        
        // Check current network state first
        await checkXverseConnection();
        const store = useWalletStore.getState();
        
        // If not on correct network, try to switch
        if (!store.isCorrectBitcoinNetwork) {
          setIsAutoSwitching(true);
          setAutoSwitchFailed(false);
          try {
            const result = await switchToL1();
            if (result.success) {
              // Refresh network state after switch
              await checkXverseConnection();
              setAutoSwitchFailed(false);
            } else {
              setAutoSwitchFailed(true);
            }
          } catch (error) {
            console.error("Auto-switch to Bitcoin network failed:", error);
            setAutoSwitchFailed(true);
          } finally {
            setIsAutoSwitching(false);
          }
        } else {
          setAutoSwitchFailed(false);
        }
      }
      // For withdraw tab: need VIA network
      else if (activeTab === "withdraw") {
        if (!isMetamaskConnected) {
          setAutoSwitchFailed(false);
          return;
        }
        
        // Check current network state first
        await checkMetamaskNetwork();
        const store = useWalletStore.getState();
        
        // If not on correct network, try to switch
        if (!store.isCorrectViaNetwork) {
          setIsAutoSwitching(true);
          setAutoSwitchFailed(false);
          try {
            const result = await switchToL2();
            if (result.success) {
              // Refresh network state after switch
              await checkMetamaskNetwork();
              setAutoSwitchFailed(false);
            } else {
              setAutoSwitchFailed(true);
            }
          } catch (error) {
            console.error("Auto-switch to VIA network failed:", error);
            setAutoSwitchFailed(true);
          } finally {
            setIsAutoSwitching(false);
          }
        } else {
          setAutoSwitchFailed(false);
        }
      }
    };

    autoSwitchNetwork();
  }, [activeTab, isXverseConnected, isMetamaskConnected, switchToL1, switchToL2, checkXverseConnection, checkMetamaskNetwork]);

  return (
    <div className="flex flex-col items-center pb-6">
      <Card className="w-full max-w-md shadow-lg bg-white border-border/50">
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
                    onTransactionSubmitted={fetchBtcTransactions}
                  />
                ) : (
                  <div className="flex flex-col items-center space-y-4 py-6">
                    {isAutoSwitching || isSwitchingNetwork ? (
                      <>
                        <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                        <h3 className="text-lg font-semibold">Switching Network</h3>
                        <p className="text-sm text-center text-muted-foreground max-w-[280px]">
                          {networkStatus || "Please confirm the network switch in your wallet..."}
                        </p>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-12 w-12 text-amber-500" />
                        <h3 className="text-lg font-semibold">Wrong Network</h3>
                        <p className="text-sm text-center text-muted-foreground max-w-[280px]">
                          {autoSwitchFailed 
                            ? "Auto-switch failed. Please switch to the correct Bitcoin network manually."
                            : "Please switch to the correct Bitcoin network to continue."}
                        </p>
                        <Button 
                          onClick={async () => {
                            setIsAutoSwitching(true);
                            try {
                              const result = await switchToL1();
                              if (result.success) {
                                await checkXverseConnection();
                              }
                            } catch (error) {
                              console.error("Network switch failed:", error);
                            } finally {
                              setIsAutoSwitching(false);
                            }
                          }}
                          disabled={isAutoSwitching || isSwitchingNetwork}
                        >
                          {isAutoSwitching || isSwitchingNetwork ? "Switching..." : "Switch Network"}
                        </Button>
                      </>
                    )}
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
                  <WithdrawForm viaAddress={viaAddress} onTransactionSubmitted={fetchBtcTransactions} />
                ) : (
                  <div className="flex flex-col items-center space-y-4 py-6">
                    {isAutoSwitching || isSwitchingNetwork ? (
                      <>
                        <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                        <h3 className="text-lg font-semibold">Switching Network</h3>
                        <p className="text-sm text-center text-muted-foreground max-w-[280px]">
                          {networkStatus || "Please confirm the network switch in your wallet..."}
                        </p>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-12 w-12 text-amber-500" />
                        <h3 className="text-lg font-semibold">Wrong Network</h3>
                        <p className="text-sm text-center text-muted-foreground max-w-[280px]">
                          {autoSwitchFailed 
                            ? "Auto-switch failed. Please switch to the VIA network manually."
                            : "Please switch to the VIA network to continue."}
                        </p>
                        <Button 
                          onClick={async () => {
                            setIsAutoSwitching(true);
                            try {
                              const result = await switchToL2();
                              if (result.success) {
                                await checkMetamaskNetwork();
                              }
                            } catch (error) {
                              console.error("Network switch failed:", error);
                            } finally {
                              setIsAutoSwitching(false);
                            }
                          }}
                          disabled={isAutoSwitching || isSwitchingNetwork}
                        >
                          {isAutoSwitching || isSwitchingNetwork ? "Switching..." : "Switch Network"}
                        </Button>
                      </>
                    )}
                  </div>
                )
              ) : (
                <WalletConnectButton
                  walletType="metamask"
                  isConnected={isMetamaskConnected}
                  helperText="EVM wallet connection is required to withdraw BTC from VIA to Bitcoin network"
                  onConnect={connectMetamask}
                  onDisconnect={disconnectMetamask}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>

        {isBothWalletConnected && (
          <CardFooter className="flex flex-col px-6 pt-0">
            <Button
              variant="ghost"
              className="flex items-center justify-between w-full py-2 text-sm font-medium"
              onClick={() => setShowTransactions(!showTransactions)}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Transaction History</span>
                {btcTransactions.length > 0 && (
                  <span className="bg-primary/10 text-primary text-xs rounded-full px-2 py-0.5">
                    {btcTransactions.length}
                  </span>
                )}
              </div>
              {showTransactions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showTransactions && (
              <div className="w-full mt-2">
                <TransactionHistory isLoading={isLoadingTransactions} onRefresh={fetchBtcTransactions} transactions={btcTransactions} />
              </div>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
