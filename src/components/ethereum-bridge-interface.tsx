"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { BridgeModeTabs, type BridgeMode } from "@/components/bridge/bridge-mode-tabs";
import { NetworkLaneSelector, TransferAmountInput, AvailableBalanceDisplay, AmountSlider } from "@/components/bridge";
import { cn } from "@/lib/utils";
import type { BridgeRoute } from "@/services/bridge/types";
import { NETWORKS } from "@/services/bridge/networks";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { VaultCard } from "@/components/vault-card";
import { SUPPORTED_ASSETS, EthereumNetwork, ETHEREUM_NETWORK_CONFIG } from "@/services/ethereum/config";
import EthereumDepositForm from "@/components/ethereum-deposit-form";
import EthereumWithdrawForm from "@/components/ethereum-withdraw-form";
import { useWalletState } from "@/hooks/use-wallet-state";
import { WalletConnectButton } from "@/components/wallets/connect-button";
import { TransactionHistory } from "@/components/transaction-history";
import { useWalletStore, walletEvents } from "@/store/wallet-store";
import PendingWithdrawals from "@/components/pending-withdrawals";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Clock, Loader2, AlertCircle } from "lucide-react";
import { fetchAaveData } from "@/services/ethereum/aave";
import { ethers } from "ethers";
import { useNetworkSwitcher } from "@/hooks/use-network-switcher";
import { EthereumNetwork as EthNetwork } from "@/services/ethereum/config";
import { ERC20_ABI } from "@/services/ethereum/abis";

// A hook to fetch APY for assets
// Note: Always fetches from Sepolia network, regardless of connected wallet network
function useAaveData() {
    const [apys, setApys] = useState<Record<string, string>>({});
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
                        const { apy } = await fetchAaveData(networkConfig.chainId, address, readProvider);
                        setApys(prev => ({ ...prev, [asset.symbol]: apy }));
                    } else {
                        setApys(prev => ({ ...prev, [asset.symbol]: asset.apy }));
                    }
                }));
            } catch (error) {
                console.error("Error in useAaveData:", error);
                // Fallback to defaults
                const defaultApys: Record<string, string> = {};
                SUPPORTED_ASSETS.forEach(a => {
                    defaultApys[a.symbol] = a.apy;
                });
                setApys(defaultApys);
            } finally {
                setLoading(false);
            }
        }

        // Only fetch once on mount, not when chainId changes
        fetchData();
    }, []); // Empty dependency array - fetch only once

    return { apys, loading };
}

// Helper to format vault TVL as compact USD-like string
function formatVaultTvl(num: number): string {
    if (num < 1000) {
        return `$${num.toFixed(2)}`;
    }
    const si = [
        { value: 1, symbol: "" },
        { value: 1E3, symbol: "K" },
        { value: 1E6, symbol: "M" },
        { value: 1E9, symbol: "B" },
        { value: 1E12, symbol: "T" },
    ];
    const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
    let i;
    for (i = si.length - 1; i > 0; i--) {
        if (num >= si[i].value) {
            break;
        }
    }
    return "$" + (num / si[i].value).toFixed(2).replace(rx, "$1") + si[i].symbol;
}

// Helper function to create Ethereum bridge route
function getEthereumRoute(mode: BridgeMode, tokenSymbol: string): BridgeRoute {
    const ethereumNetwork = {
        id: 'ethereum-sepolia',
        displayName: 'Ethereum Sepolia',
        chainId: 11155111,
        type: 'evm' as const,
        icon: '/ethereum-logo.png',
    };

    const viaNetwork = NETWORKS.VIA_TESTNET;

    const token = {
        symbol: tokenSymbol,
        name: tokenSymbol,
        decimals: 6, // USDC uses 6 decimals
        icon: `/tokens/${tokenSymbol.toLowerCase()}.png`,
    };

    return {
        id: mode === 'deposit' ? 'ethereum-sepolia-to-via-testnet' : 'via-testnet-to-ethereum-sepolia',
        fromNetwork: mode === 'deposit' ? ethereumNetwork : viaNetwork,
        toNetwork: mode === 'deposit' ? viaNetwork : ethereumNetwork,
        token,
        direction: mode,
        enabled: true,
    };
}

export default function EthereumBridgeInterface() {
    const [activeTab, setActiveTab] = useState<BridgeMode>("deposit");

    // Ensure default selected asset is active
    const defaultAsset = SUPPORTED_ASSETS.find(a => a.active) || SUPPORTED_ASSETS[0];
    const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string>(defaultAsset.symbol);

    const [isYieldEnabled, setIsYieldEnabled] = useState<boolean>(true);
    const [showTransactions, setShowTransactions] = useState(false);

    const [vaultTvl, setVaultTvl] = useState<string | null>(null);
    const [isLoadingVaultTvl, setIsLoadingVaultTvl] = useState(false);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPendingWithdrawalsOpen, setIsPendingWithdrawalsOpen] = useState(false);
    const [readyWithdrawalsCount, setReadyWithdrawalsCount] = useState(0);
    const [isMounted, setIsMounted] = useState(false);
    const [amount, setAmount] = useState<string>("");
    const [balance, setBalance] = useState<string | null>(null);
    const [isLoadingBalance, setIsLoadingBalance] = useState(false);

    // Track if component is mounted (client-side only) to prevent hydration mismatches
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const { isMetamaskConnected, isCorrectL1Network, isCorrectViaNetwork, l1Address, viaAddress } = useWalletState();
    const { ethTransactions, isLoadingTransactions, fetchEthTransactions, checkL1Network, checkMetamaskNetwork } = useWalletStore();
    const { switchToEthereum, switchToL2, isSwitching: isSwitchingNetwork, status: networkStatus } = useNetworkSwitcher();
    const [isAutoSwitching, setIsAutoSwitching] = useState(false);
    const [autoSwitchFailed, setAutoSwitchFailed] = useState(false);

    const { apys, loading: loadingApy } = useAaveData();

    const selectedAsset = SUPPORTED_ASSETS.find(a => a.symbol === selectedAssetSymbol) || defaultAsset;
    const route = getEthereumRoute(activeTab, selectedAsset.symbol);

    // Fetch balance based on active tab
    useEffect(() => {
        async function fetchBalance() {
            if (!isMetamaskConnected) {
                setBalance(null);
                return;
            }

            // For deposit: use l1Address or viaAddress (same wallet, different networks)
            // For withdraw: use viaAddress
            const address = activeTab === "deposit" ? (l1Address || viaAddress) : viaAddress;
            const isCorrectNetwork = activeTab === "deposit" ? isCorrectL1Network : isCorrectViaNetwork;
            const tokenAddress = activeTab === "deposit" 
                ? selectedAsset.addresses?.[EthereumNetwork.SEPOLIA]
                : (isYieldEnabled ? selectedAsset.vaults.l2.yield : selectedAsset.vaults.l2.normal);

            // If no address, try to get it from the wallet provider directly
            let walletAddress = address;
            if (!walletAddress && typeof window !== "undefined" && window.ethereum) {
                try {
                    const { BrowserProvider } = await import("ethers");
                    const browserProvider = new BrowserProvider(window.ethereum);
                    const signer = await browserProvider.getSigner();
                    walletAddress = await signer.getAddress();
                } catch (err) {
                    console.error("Error getting wallet address:", err);
                }
            }

            if (!walletAddress || !tokenAddress) {
                setBalance(null);
                return;
            }

            // For deposit, we still need to be on the correct network
            // For withdraw, we need to be on VIA network
            if (activeTab === "deposit" && !isCorrectNetwork) {
                setBalance(null);
                return;
            }
            if (activeTab === "withdraw" && !isCorrectViaNetwork) {
                setBalance(null);
                return;
            }

            try {
                setIsLoadingBalance(true);
                if (typeof window === "undefined" || !window.ethereum) {
                    setBalance(null);
                    return;
                }
                const { BrowserProvider, Contract, formatUnits } = await import("ethers");
                const browserProvider = new BrowserProvider(window.ethereum);
                const tokenContract = new Contract(tokenAddress, ERC20_ABI, browserProvider);
                const bal = await tokenContract.balanceOf(walletAddress);
                const balFormatted = formatUnits(bal, selectedAsset.decimals);
                setBalance(balFormatted);
            } catch (err) {
                console.error("Error fetching balance:", err);
                setBalance(null);
            } finally {
                setIsLoadingBalance(false);
            }
        }

        fetchBalance();
    }, [activeTab, isMetamaskConnected, l1Address, viaAddress, isCorrectL1Network, isCorrectViaNetwork, selectedAsset, isYieldEnabled]);

    // Calculate amount values
    const amountNumber = parseFloat(amount) || 0;
    const maxAmount = balance ? parseFloat(balance) : 0;

    const handleSwap = () => {
        setActiveTab(activeTab === "deposit" ? "withdraw" : "deposit");
        setAmount("");
    };

    const handleMaxAmount = () => {
        if (balance) {
            setAmount(maxAmount.toFixed(selectedAsset.decimals));
        }
    };

    const handleSliderChange = (value: number) => {
        setAmount(value.toFixed(selectedAsset.decimals));
    };

    // Fetch TVL from the currently selected L1 vault (normal or yield)
    useEffect(() => {
        async function fetchVaultTvl() {
            try {
                setIsLoadingVaultTvl(true);

                const asset = SUPPORTED_ASSETS.find(a => a.symbol === selectedAssetSymbol) || SUPPORTED_ASSETS[0];
                const vaultAddress = isYieldEnabled ? asset.vaults.l1.yield : asset.vaults.l1.normal;

                // Skip if vault address is not configured
                if (
                    !vaultAddress ||
                    vaultAddress === "0x..." ||
                    vaultAddress === "0x0000000000000000000000000000000000000000"
                ) {
                    setVaultTvl(null);
                    return;
                }

                const networkConfig = ETHEREUM_NETWORK_CONFIG[EthereumNetwork.SEPOLIA];
                const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrls[0]);

                const vaultToken = new ethers.Contract(vaultAddress, ERC20_ABI, provider);
                const totalSupply = await vaultToken.totalSupply();

                // Assume vault token shares use the same decimals as the underlying asset (e.g., USDC 6 decimals)
                const amount = Number(ethers.formatUnits(totalSupply, asset.decimals));
                const formatted = formatVaultTvl(amount);

                setVaultTvl(formatted);
            } catch (error) {
                console.error("[EthereumBridgeInterface] Error fetching vault TVL:", error);
                setVaultTvl(null);
            } finally {
                setIsLoadingVaultTvl(false);
            }
        }

        fetchVaultTvl();
    }, [selectedAssetSymbol, isYieldEnabled]);

    // Use the ready count from pending withdrawals component
    // This is updated when MessageManager checks are complete
    // Only show count after mount to prevent hydration mismatches
    const pendingWithdrawalsCount = isMounted ? readyWithdrawalsCount : 0;

    // Merge dynamic APY into selected asset
    const currentApy = apys[selectedAsset.symbol] || selectedAsset.apy;
    const currentTvl = vaultTvl || selectedAsset.tvl;

    // Create displayAsset but override apy with dynamic values.
    // When "Normal bridging without yield" is enabled, show 0% APY.
    const displayApy = isYieldEnabled
        ? (loadingApy ? "..." : currentApy)
        : "0%";

    // TVL represents value bridged through the selected vault (normal or yield)
    const displayAsset = {
        ...selectedAsset,
        apy: displayApy,
        tvl: isLoadingVaultTvl ? "..." : currentTvl
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
        <div className={cn("w-full flex justify-center py-8 px-4")}>
            <div className="w-full max-w-4xl">
                {/* Mode tabs */}
                <BridgeModeTabs 
                    mode={activeTab} 
                    onModeChange={(mode) => setActiveTab(mode)}
                    withdrawBadgeCount={pendingWithdrawalsCount}
                    onWithdrawBadgeClick={() => setIsPendingWithdrawalsOpen(true)}
                />

                {/* Card container */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
                    {/* Title */}
                    <div className="text-center mb-4 pt-8 px-8">
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Ethereum Bridge</h1>
                        <p className="text-sm text-slate-600">Bridge assets securely between Ethereum and VIA network</p>
                    </div>

                    {/* Asset Selection */}
                    <div className="px-8 mb-4">
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
                            yieldEnabled={isYieldEnabled}
                            onYieldToggle={(enabled) => setIsYieldEnabled(enabled)}
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

                    {/* Content */}
                    <div className="px-8 pb-8">
                        {/* Pending Withdrawals Banner - Show only on withdrawal tab */}
                        {activeTab === "withdraw" && pendingWithdrawalsCount > 0 && (
                            <div
                                className="mb-6 p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-lg cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-all border-2 border-blue-400"
                                onClick={() => setIsPendingWithdrawalsOpen(true)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setIsPendingWithdrawalsOpen(true);
                                    }
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                                            <Clock className="h-5 w-5 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-base font-bold text-white mb-0.5">
                                                You have {pendingWithdrawalsCount} pending withdrawal claim{pendingWithdrawalsCount > 1 ? "s" : ""}.
                                            </p>
                                            <p className="text-sm text-blue-100">
                                                Click to view & claim
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full">
                                            {pendingWithdrawalsCount} ready
                                        </span>
                                        <span className="text-white text-sm font-medium">→</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Network Lane */}
                        <NetworkLaneSelector route={route} onSwap={handleSwap} />

                        {/* Amount section conditionally shown if a balance is available */}
                        {balance && parseFloat(balance) > 0 && (
                            <div className="space-y-6 mb-8">
                                <TransferAmountInput 
                                    value={amount} 
                                    onChange={setAmount} 
                                    onMax={handleMaxAmount} 
                                    unit={selectedAsset.symbol} 
                                    maxDisabled={!balance || parseFloat(balance) <= 0}
                                />
                            </div>
                        )}

                        {/* Balance Display */}
                        <div className="mb-6">
                            <AvailableBalanceDisplay 
                                balance={balance} 
                                unit={selectedAsset.symbol} 
                                isLoading={isLoadingBalance} 
                            />
                        </div>

                        {/* Amount slider conditionally shown if balance is available */}
                        {balance && parseFloat(balance) > 0 && (
                            <div className="mb-6">
                                <AmountSlider 
                                    value={amountNumber} 
                                    max={maxAmount} 
                                    onChange={handleSliderChange} 
                                    unit={selectedAsset.symbol}
                                    decimals={selectedAsset.decimals}
                                />
                            </div>
                        )}

                        {/* Form Content */}
                        {activeTab === "deposit" ? (
                            isMetamaskConnected ? (
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
                                        amount={amount}
                                        onAmountReset={() => setAmount("")}
                                    />
                                )
                            ) : (
                                <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-slate-50/50 rounded-xl border border-border/50">
                                    <div className="text-center space-y-2">
                                        <h3 className="text-xl font-semibold">Connect EVM Wallet</h3>
                                        <p className="text-sm text-muted-foreground max-w-[280px]">
                                            EVM wallet connection is required to deposit from Ethereum to VIA network
                                        </p>
                                    </div>
                                    <WalletConnectButton />
                                </div>
                            )
                        ) : (
                            <>
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
                                            amount={amount}
                                            onAmountReset={() => setAmount("")}
                                        />
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-slate-50/50 rounded-xl border border-border/50">
                                        <div className="text-center space-y-2">
                                            <h3 className="text-xl font-semibold">Connect EVM Wallet</h3>
                                            <p className="text-sm text-muted-foreground max-w-[280px]">
                                                EVM wallet connection is required to withdraw from VIA to Ethereum network
                                            </p>
                                        </div>
                                        <WalletConnectButton />
                                    </div>
                                )}
                            </>
                        )}

                        {/* Transaction History */}
                        {isMetamaskConnected && (
                            <div className="mt-8 pt-6 border-t border-slate-200">
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
                                    <div className="w-full mt-4">
                                        <TransactionHistory 
                                            isLoading={isLoadingTransactions} 
                                            onRefresh={fetchEthTransactions} 
                                            transactions={ethTransactions}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
