"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { VaultCard } from "@/components/vault-card";
import { SUPPORTED_ASSETS, EthereumNetwork, ETHEREUM_NETWORK_CONFIG } from "@/services/ethereum/config";
import EthereumDepositForm from "@/components/ethereum-deposit-form";
import EthereumWithdrawForm from "@/components/ethereum-withdraw-form";
import { useWalletState } from "@/hooks/use-wallet-state";
import WalletConnectButton from "@/components/wallet-connect-button";
import { TransactionHistory } from "@/components/transaction-history";
import { useWalletStore, walletEvents } from "@/store/wallet-store";
import PendingWithdrawals from "@/components/pending-withdrawals";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Clock, Loader2, AlertCircle } from "lucide-react";
import { CardFooter } from "@/components/ui/card";
import { fetchAaveData } from "@/services/ethereum/aave";
import { ethers } from "ethers";
import { useNetworkSwitcher } from "@/hooks/use-network-switcher";
import { EthereumNetwork as EthNetwork } from "@/services/ethereum/config";

// A hook to fetch APY for assets
// Note: Always fetches from Sepolia network, regardless of connected wallet network
function useAaveData() {
    const [apys, setApys] = useState<Record<string, string>>({});
    const [tvls, setTvls] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        async function fetchData() {
            setLoading(true);

            let readProvider: ethers.Provider;

            try {
                // Always use Sepolia, regardless of connected chain
                const targetChainId = EthereumNetwork.SEPOLIA;
                const networkConfig = ETHEREUM_NETWORK_CONFIG[EthereumNetwork.SEPOLIA];

                const rpcUrl = networkConfig.rpcUrls[0];
                readProvider = new ethers.JsonRpcProvider(rpcUrl);

                await Promise.all(SUPPORTED_ASSETS.map(async (asset) => {
                    if (!asset.active) {
                        return; // Skip inactive assets
                    }

                    const address = asset.addresses?.[targetChainId as EthereumNetwork] || asset.addresses?.[EthereumNetwork.SEPOLIA];
                    if (address && address !== '0x0000000000000000000000000000000000000000') {
                        const { apy, tvl } = await fetchAaveData(networkConfig.chainId, address, readProvider);
                        setApys(prev => ({ ...prev, [asset.symbol]: apy }));
                        setTvls(prev => ({ ...prev, [asset.symbol]: tvl }));
                    } else {
                        setApys(prev => ({ ...prev, [asset.symbol]: asset.apy }));
                        setTvls(prev => ({ ...prev, [asset.symbol]: asset.tvl }));
                    }
                }));
            } catch (error) {
                console.error("Error in useAaveData:", error);
                // Fallback to defaults
                const defaultApys: Record<string, string> = {};
                const defaultTvls: Record<string, string> = {};
                SUPPORTED_ASSETS.forEach(a => {
                    defaultApys[a.symbol] = a.apy;
                    defaultTvls[a.symbol] = a.tvl;
                });
                setApys(defaultApys);
                setTvls(defaultTvls);
            } finally {
                setLoading(false);
            }
        }

        // Only fetch once on mount, not when chainId changes
        fetchData();
    }, []); // Empty dependency array - fetch only once

    return { apys, tvls, loading };
}

export default function EthereumBridgeInterface() {
    const [activeTab, setActiveTab] = useState<string>("deposit");

    // Ensure default selected asset is active
    const defaultAsset = SUPPORTED_ASSETS.find(a => a.active) || SUPPORTED_ASSETS[0];
    const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string>(defaultAsset.symbol);

    const [isYieldEnabled, setIsYieldEnabled] = useState<boolean>(true);
    const [showTransactions, setShowTransactions] = useState(false);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPendingWithdrawalsOpen, setIsPendingWithdrawalsOpen] = useState(false);
    const [readyWithdrawalsCount, setReadyWithdrawalsCount] = useState(0);
    const [isMounted, setIsMounted] = useState(false);

    // Track if component is mounted (client-side only) to prevent hydration mismatches
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const { isMetamaskConnected, connectMetamask, disconnectMetamask, isCorrectL1Network, isCorrectViaNetwork, l1Address, viaAddress } = useWalletState();
    const { ethTransactions, isLoadingTransactions, fetchEthTransactions, checkL1Network, checkMetamaskNetwork } = useWalletStore();
    const { switchToEthereum, switchToL2, isSwitching: isSwitchingNetwork, status: networkStatus } = useNetworkSwitcher();
    const [isAutoSwitching, setIsAutoSwitching] = useState(false);
    const [autoSwitchFailed, setAutoSwitchFailed] = useState(false);

    const { apys, tvls, loading: loadingApy } = useAaveData();

    const selectedAsset = SUPPORTED_ASSETS.find(a => a.symbol === selectedAssetSymbol) || defaultAsset;

    // Use the ready count from pending withdrawals component
    // This is updated when MessageManager checks are complete
    // Only show count after mount to prevent hydration mismatches
    const pendingWithdrawalsCount = isMounted ? readyWithdrawalsCount : 0;

    // Merge dynamic APY and TVL into selected asset
    const currentApy = apys[selectedAsset.symbol] || selectedAsset.apy;
    const currentTvl = tvls[selectedAsset.symbol] || selectedAsset.tvl;

    // Create displayAsset but override apy/tvl with dynamic values
    const displayAsset = {
        ...selectedAsset,
        apy: loadingApy ? "..." : currentApy,
        tvl: loadingApy ? "..." : currentTvl
    };

    // Auto-switch network when wallet is connected but on wrong network
    // Skip auto-switch if pending withdrawals modal is open (it needs Sepolia)
    useEffect(() => {
        const autoSwitchNetwork = async () => {
            if (!isMetamaskConnected) {
                setAutoSwitchFailed(false);
                return;
            }

            // Don't auto-switch if pending withdrawals modal is open (it needs Sepolia)
            if (isPendingWithdrawalsOpen) {
                return;
            }

            // For deposit tab: need Sepolia network
            if (activeTab === "deposit") {
                // First check current network state
                await checkL1Network();
                
                // If still on wrong network, try to switch
                if (!isCorrectL1Network) {
                    setIsAutoSwitching(true);
                    setAutoSwitchFailed(false);
                    try {
                        const result = await switchToEthereum(EthNetwork.SEPOLIA);
                        if (result.success) {
                            // Refresh network state after switch
                            await checkL1Network();
                            setAutoSwitchFailed(false);
                            
                            // Fetch transactions after successful network switch
                            setTimeout(() => {
                                const store = useWalletStore.getState();
                                const effectiveL1Address = store.l1Address || store.viaAddress;
                                const effectiveL2Address = store.viaAddress || store.l1Address;
                                if (effectiveL1Address && effectiveL2Address) {
                                    fetchEthTransactions();
                                }
                            }, 1000);
                        } else {
                            setAutoSwitchFailed(true);
                        }
                    } catch (error) {
                        console.error("Auto-switch to Sepolia failed:", error);
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
                // First check current network state
                await checkMetamaskNetwork();
                
                // If still on wrong network, try to switch
                if (!isCorrectViaNetwork) {
                    setIsAutoSwitching(true);
                    setAutoSwitchFailed(false);
                    try {
                        const result = await switchToL2();
                        if (result.success) {
                            // Refresh network state after switch
                            await checkMetamaskNetwork();
                            setAutoSwitchFailed(false);
                            
                            // Fetch transactions after successful network switch
                            setTimeout(() => {
                                const store = useWalletStore.getState();
                                const effectiveL1Address = store.l1Address || store.viaAddress;
                                const effectiveL2Address = store.viaAddress || store.l1Address;
                                if (effectiveL1Address && effectiveL2Address) {
                                    fetchEthTransactions();
                                }
                            }, 1000);
                        } else {
                            setAutoSwitchFailed(true);
                        }
                    } catch (error) {
                        console.error("Auto-switch to VIA failed:", error);
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
    }, [activeTab, isMetamaskConnected, isCorrectL1Network, isCorrectViaNetwork, switchToEthereum, switchToL2, checkL1Network, checkMetamaskNetwork, isPendingWithdrawalsOpen, fetchEthTransactions]);

    // Fetch transaction history when addresses are available
    useEffect(() => {
        if (!isMetamaskConnected) {
            return;
        }
        
        // Check store state directly to get latest addresses
        const store = useWalletStore.getState();
        const effectiveL1Address = store.l1Address || store.viaAddress;
        const effectiveL2Address = store.viaAddress || store.l1Address;
        
        // Fetch if we have at least one address (same wallet on different networks)
        if (effectiveL1Address && effectiveL2Address) {
            fetchEthTransactions();
        }
    }, [isMetamaskConnected, l1Address, viaAddress, fetchEthTransactions]);

    // Listen for wallet events to auto-fetch transactions
    useEffect(() => {
        const unsubscribers = [
            walletEvents.metamaskConnected.on(() => {
                // Fetch transactions when MetaMask connects
                // Use a delay to ensure addresses are set
                setTimeout(() => {
                    const store = useWalletStore.getState();
                    const effectiveL1Address = store.l1Address || store.viaAddress;
                    const effectiveL2Address = store.viaAddress || store.l1Address;
                    if (effectiveL1Address && effectiveL2Address) {
                        fetchEthTransactions();
                    }
                }, 1000);
            }),
            walletEvents.networkChanged.on(() => {
                // Fetch transactions when network changes
                // Use a delay to ensure addresses are updated after network switch
                setTimeout(() => {
                    const store = useWalletStore.getState();
                    if (store.isMetamaskConnected) {
                        const effectiveL1Address = store.l1Address || store.viaAddress;
                        const effectiveL2Address = store.viaAddress || store.l1Address;
                        if (effectiveL1Address && effectiveL2Address) {
                            fetchEthTransactions();
                        }
                    }
                }, 1000);
            }),
        ];

        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe());
        };
    }, [fetchEthTransactions]);

    return (
        <div className="flex flex-col items-center pb-6 space-y-6 w-full max-w-4xl">

            {/* Asset Selection */}
            <div className="w-full max-w-md">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Select Token Vault</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            {SUPPORTED_ASSETS.map((asset) => {
                                const isActive = asset.active;
                                return (
                                    <div
                                        key={asset.symbol}
                                        className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${isActive
                                            ? 'cursor-pointer hover:bg-slate-50'
                                            : 'opacity-50 cursor-not-allowed bg-slate-100'
                                            } ${selectedAssetSymbol === asset.symbol ? 'border-primary bg-primary/5' : 'border-border'}`}
                                        onClick={() => {
                                            if (isActive) {
                                                setSelectedAssetSymbol(asset.symbol);
                                                setIsDialogOpen(false);
                                            }
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="relative h-8 w-8 rounded-full overflow-hidden">
                                                <Image
                                                    src={asset.icon}
                                                    alt={asset.symbol}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div>
                                                <p className="font-medium">{asset.name}</p>
                                                <p className="text-sm text-muted-foreground">{asset.symbol}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            {!isActive && <span className="text-xs text-muted-foreground mr-2">(Coming Soon)</span>}
                                            <p className="text-sm font-medium text-green-600">
                                                {loadingApy && isActive ? <Loader2 className="h-4 w-4 animate-spin" /> : `APY ${apys[asset.symbol] || asset.apy}`}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </DialogContent>
                </Dialog>

                <VaultCard
                    symbol={displayAsset.symbol}
                    name={displayAsset.name}
                    icon={displayAsset.icon}
                    apy={displayAsset.apy}
                    tvl={displayAsset.tvl}
                    isSelected={true}
                    selectionHint="Change"
                    onClick={() => setIsDialogOpen(true)}
                />
            </div>

            {/* Pending Withdrawals Modal */}
            <PendingWithdrawals 
                transactions={ethTransactions}
                onClaimSuccess={fetchEthTransactions}
                open={isPendingWithdrawalsOpen}
                onOpenChange={setIsPendingWithdrawalsOpen}
                onReadyCountChange={setReadyWithdrawalsCount}
            />

            <Card className="w-full max-w-md shadow-lg bg-white border-border/50">
                <CardContent className="pt-6">
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
                                className="text-sm font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-200 hover:bg-white/80 relative"
                            >
                                Withdraw
                                {pendingWithdrawalsCount > 0 && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsPendingWithdrawalsOpen(true);
                                        }}
                                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold hover:bg-red-600 transition-colors"
                                        title={`${pendingWithdrawalsCount} pending withdrawal${pendingWithdrawalsCount > 1 ? 's' : ''} ready to claim`}
                                    >
                                        {pendingWithdrawalsCount}
                                    </button>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        {/* Yield Toggle */}
                        <div className="flex items-center space-x-2 mb-6 justify-center">
                            <Checkbox
                                id="yield-mode"
                                checked={!isYieldEnabled}
                                onCheckedChange={(checked) => setIsYieldEnabled(!checked)}
                            />
                            <Label htmlFor="yield-mode" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Normal bridging without yield
                            </Label>
                        </div>

                        <TabsContent value="deposit">
                            {isMetamaskConnected ? (
                                isAutoSwitching || isSwitchingNetwork ? (
                                    <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground">
                                            {networkStatus || "Switching to Sepolia network..."}
                                        </p>
                                    </div>
                                ) : (!isCorrectL1Network || autoSwitchFailed) ? (
                                    <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                                        <div className="rounded-full bg-amber-100 p-4">
                                            <AlertCircle className="h-8 w-8 text-amber-600" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="font-semibold">Switch to Sepolia</h3>
                                            <p className="text-sm text-muted-foreground max-w-[250px]">
                                                {autoSwitchFailed 
                                                    ? "Automatic network switch failed. Please switch manually."
                                                    : "Your wallet is connected. Please switch to Sepolia network to continue."}
                                            </p>
                                        </div>
                                        <Button 
                                            onClick={async () => {
                                                setIsAutoSwitching(true);
                                                try {
                                                    const result = await switchToEthereum(EthNetwork.SEPOLIA);
                                                    if (result.success) {
                                                        await checkL1Network();
                                                        setAutoSwitchFailed(false);
                                                    } else {
                                                        setAutoSwitchFailed(true);
                                                    }
                                                } catch {
                                                    setAutoSwitchFailed(true);
                                                } finally {
                                                    setIsAutoSwitching(false);
                                                }
                                            }}
                                            className="w-full max-w-[200px]"
                                            disabled={isAutoSwitching || isSwitchingNetwork}
                                        >
                                            {isAutoSwitching || isSwitchingNetwork ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Switching...
                                                </>
                                            ) : (
                                                "Switch to Sepolia"
                                            )}
                                        </Button>
                                    </div>
                                ) : (
                                    <EthereumDepositForm
                                        asset={displayAsset}
                                        isYield={isYieldEnabled}
                                    />
                                )
                            ) : (
                                <WalletConnectButton
                                    walletType="metamask"
                                    isConnected={isMetamaskConnected}
                                    helperText="EVM wallet connection is required to deposit from Ethereum to VIA network"
                                    onConnect={connectMetamask}
                                    onDisconnect={disconnectMetamask}
                                />
                            )}
                        </TabsContent>

                        <TabsContent value="withdraw">
                            {/* Pending Withdrawals Banner */}
                            {pendingWithdrawalsCount > 0 && (
                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-4 w-4 text-blue-600" />
                                            <p className="text-sm text-blue-900">
                                                You have <span className="font-semibold">{pendingWithdrawalsCount}</span> pending withdrawal claim{pendingWithdrawalsCount > 1 ? 's' : ''} ready to claim on Sepolia.
                                            </p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsPendingWithdrawalsOpen(true)}
                                            className="text-blue-700 border-blue-300 hover:bg-blue-100"
                                        >
                                            View & Claim
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {isMetamaskConnected ? (
                                isAutoSwitching || isSwitchingNetwork ? (
                                    <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground">
                                            {networkStatus || "Switching to VIA network..."}
                                        </p>
                                    </div>
                                ) : (!isCorrectViaNetwork || autoSwitchFailed) ? (
                                    <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                                        <div className="rounded-full bg-amber-100 p-4">
                                            <AlertCircle className="h-8 w-8 text-amber-600" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="font-semibold">Switch to VIA Network</h3>
                                            <p className="text-sm text-muted-foreground max-w-[250px]">
                                                {autoSwitchFailed 
                                                    ? "Automatic network switch failed. Please switch manually."
                                                    : "Your wallet is connected. Please switch to VIA network to continue."}
                                            </p>
                                        </div>
                                        <Button 
                                            onClick={async () => {
                                                setIsAutoSwitching(true);
                                                try {
                                                    const result = await switchToL2();
                                                    if (result.success) {
                                                        await checkMetamaskNetwork();
                                                        setAutoSwitchFailed(false);
                                                    } else {
                                                        setAutoSwitchFailed(true);
                                                    }
                                                } catch {
                                                    setAutoSwitchFailed(true);
                                                } finally {
                                                    setIsAutoSwitching(false);
                                                }
                                            }}
                                            className="w-full max-w-[200px]"
                                            disabled={isAutoSwitching || isSwitchingNetwork}
                                        >
                                            {isAutoSwitching || isSwitchingNetwork ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Switching...
                                                </>
                                            ) : (
                                                "Switch to VIA Network"
                                            )}
                                        </Button>
                                    </div>
                                ) : (
                                    <EthereumWithdrawForm
                                        asset={displayAsset}
                                        isYield={isYieldEnabled}
                                    />
                                )
                            ) : (
                                <WalletConnectButton
                                    walletType="metamask"
                                    isConnected={isMetamaskConnected}
                                    helperText="EVM wallet connection is required to withdraw from VIA to Ethereum network"
                                    onConnect={connectMetamask}
                                    onDisconnect={disconnectMetamask}
                                />
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>

                {isMetamaskConnected && (
                    <CardFooter className="flex flex-col px-6 pt-0">
                        <Button
                            variant="ghost"
                            className="flex items-center justify-between w-full py-2 text-sm font-medium"
                            onClick={() => setShowTransactions(!showTransactions)}
                        >
                            <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>Transaction History</span>
                                {ethTransactions.length > 0 && (
                                    <span className="bg-primary/10 text-primary text-xs rounded-full px-2 py-0.5">
                                        {ethTransactions.length}
                                    </span>
                                )}
                            </div>
                            {showTransactions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>

                        {showTransactions && (
                            <div className="w-full mt-2">
                                <TransactionHistory isLoading={isLoadingTransactions} onRefresh={fetchEthTransactions} transactions={ethTransactions} />
                            </div>
                        )}
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
