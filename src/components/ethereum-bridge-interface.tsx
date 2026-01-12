// src/components/ethereum-bridge-interface.tsx
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { BridgeModeTabs, type BridgeMode } from "@/components/bridge/bridge-mode-tabs";
import { NetworkLaneSelector, TransferAmountInput, AvailableBalanceDisplay, AmountSlider } from "@/components/bridge";
import { cn } from "@/lib/utils";
import type { BridgeRoute } from "@/services/bridge/types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { VaultCard } from "@/components/vault-card";
import { SUPPORTED_ASSETS, EthereumNetwork } from "@/services/ethereum/config";
import EthereumDepositForm from "@/components/ethereum-deposit-form";
import EthereumWithdrawForm from "@/components/ethereum-withdraw-form";
import { useWalletState } from "@/hooks/use-wallet-state";
import { WalletConnectButton } from "@/components/wallets/connect-button";
import { TransactionHistory } from "@/components/transaction-history";
import { useWalletStore, walletEvents } from "@/store/wallet-store";
import PendingWithdrawals from "@/components/pending-withdrawals";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Clock, Loader2, AlertCircle } from "lucide-react";
import { useAaveData } from "@/hooks/use-aave-data";
import { useVaultMetrics } from "@/hooks/use-vault-metrics";
import { useEthereumBalance } from "@/hooks/use-ethereum-balance";
import { calculateVaultConversion } from "@/utils/vault-conversion";
import { toast } from "sonner";
import {formatVaultRate} from "@/utils/vault-conversion";
import { useSwitchChain, useChainId } from "wagmi";
import { BRIDGE_CONFIG } from "@/services/config";
import { GetCurrentRoute } from "@/services/bridge/routes";

export default function EthereumBridgeInterface() {
    const [activeTab, setActiveTab] = useState<BridgeMode>("deposit");

    // Ensure default selected asset is active
    const defaultAsset = SUPPORTED_ASSETS.find(a => a.active) || SUPPORTED_ASSETS[0];
    const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string>(defaultAsset.symbol);

    const [isYieldEnabled, setIsYieldEnabled] = useState<boolean>(true);
    const [showTransactions, setShowTransactions] = useState(false);

    const [apys, setApys] = useState<Record<string, string>>({});

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isPendingWithdrawalsOpen, setIsPendingWithdrawalsOpen] = useState(false);
    const [readyWithdrawalsCount, setReadyWithdrawalsCount] = useState(0);
    const [isMounted, setIsMounted] = useState(false);
    const [amount, setAmount] = useState<string>("");

    // Track if component is mounted (client-side only) to prevent hydration mismatches
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const { isMetamaskConnected, isCorrectL1Network, isCorrectViaNetwork, l1Address, viaAddress } = useWalletState();
    const { ethTransactions, isLoadingTransactions, fetchEthTransactions, checkL1Network, checkMetamaskNetwork } = useWalletStore();
    const { switchChainAsync: switchChain, isPending: isSwitchingNetwork } = useSwitchChain();
    const currentChainId = useChainId();
    const [isAutoSwitching, setIsAutoSwitching] = useState(false);
    const [autoSwitchFailed, setAutoSwitchFailed] = useState(false);

    // Get current route based on active tab (uses bridge domain model)
    const route = useMemo(() => 
        GetCurrentRoute(activeTab, BRIDGE_CONFIG.defaultNetwork, 'ethereum'),
        [activeTab]
    );

    // Derive target chain from route
    const targetChainId = route.fromNetwork.chainId!;
    const targetChainName = route.fromNetwork.displayName;

    // Derive if we need to switch (skip if pending withdrawals modal is open - it needs Sepolia)
    const needsSwitch = isMetamaskConnected && currentChainId !== targetChainId && !isPendingWithdrawalsOpen;

    // Use Aave data as fallback, but API will override for yield vaults
    const { apys: aaveApys, isLoading: loadingApy } = useAaveData();
    
    // Initialize apys from Aave data
    useEffect(() => {
        setApys(aaveApys);
    }, [aaveApys]);

    // Fetch vault metrics (TVL, APY, exchange rate)
    const { metrics: vaultMetrics, isLoading: isLoadingVaultMetrics } = useVaultMetrics({
        assetSymbol: selectedAssetSymbol,
        isYieldEnabled,
    });

    const selectedAsset = SUPPORTED_ASSETS.find(a => a.symbol === selectedAssetSymbol) || defaultAsset;

    // Update APY from vault metrics when available (overrides Aave data for yield vaults)
    useEffect(() => {
        if (vaultMetrics.apy && isYieldEnabled) {
            setApys((prev) => ({ ...prev, [selectedAssetSymbol]: vaultMetrics.apy! }));
        }
    }, [vaultMetrics.apy, isYieldEnabled, selectedAssetSymbol]);

    // Derive exchange rate display string
    const exchangeRateDisplay = useMemo(() => {
        if (!isYieldEnabled || !vaultMetrics.exchangeRate) return null;

        const underlyingSymbol = selectedAsset.symbol; // e.g., "USDC"
        const vaultShareSymbol = selectedAsset.l2ValueSymbol || `v${underlyingSymbol}`; // e.g., "vUSDC"

        return formatVaultRate(
            vaultMetrics.exchangeRate,
            underlyingSymbol,
            vaultShareSymbol,
            activeTab
        );
    }, [isYieldEnabled, vaultMetrics.exchangeRate, selectedAsset, activeTab]);

    // Token address for balance fetching
  // - Deposit: fetch underlying token balance on Ethereum L1 (e.g., USDC on Sepolia)
  // - Withdraw: fetch underlying token balance on Via L2 (e.g., USDC on Via)
  const underlyingTokenAddress = selectedAsset.addresses?.[EthereumNetwork.SEPOLIA];
  const vaultShareAddress = isYieldEnabled
    ? selectedAsset.vaultAddresses.via.yieldBearing
    : selectedAsset.vaultAddresses.via.standard;

  const balanceTokenAddress = activeTab === "deposit" ? underlyingTokenAddress : vaultShareAddress;

  // compute wallet address and network check based on mode
  const balanceWalletAddress = activeTab === "deposit" ? (l1Address || viaAddress) : viaAddress;
  const isCorrectNetworkForBalance = activeTab === "deposit" ? isCorrectL1Network : isCorrectViaNetwork;

  // fetch balance using hook
  const { balance, isLoading: isLoadingBalance, refetch } = useEthereumBalance({
    tokenAddress: balanceTokenAddress,
    walletAddress: balanceWalletAddress,
    decimals: selectedAsset.decimals,
    isOnCorrectNetwork: isCorrectNetworkForBalance,
    isConnected: isMetamaskConnected
  });

    // Calculate amount values
    const amountNumber = parseFloat(amount) || 0;
    const maxAmount = balance ? parseFloat(balance) : 0;

    // Calculate expected amount to receive for withdrawal (l2ValueSymbol -> base symbol)
    const expectedAmountData = useMemo(() => {
        if (activeTab !== "withdraw" || !isYieldEnabled || !amountNumber || !vaultMetrics.exchangeRate) {
            return null;
        }
        return calculateVaultConversion(amountNumber, vaultMetrics.exchangeRate, "withdraw", selectedAsset.decimals);
    }, [activeTab, isYieldEnabled, amountNumber, vaultMetrics.exchangeRate, selectedAsset.decimals]);

    const handleSwap = () => {
        setActiveTab(activeTab === "deposit" ? "withdraw" : "deposit");
        setAmount("");
    };

    const handleMaxAmount = () => {
        if (balance) {
            // Limit to asset decimals to prevent underflow
            const max = Math.min(maxAmount, parseFloat(balance));
            setAmount(max.toFixed(selectedAsset.decimals));
        }
    };

    const handleSliderChange = (value: number) => {
        // Limit to asset decimals to prevent underflow
        const limitedValue = Math.min(value, maxAmount);
        setAmount(limitedValue.toFixed(selectedAsset.decimals));
    };

    // Sanitize amount input to prevent invalid values
    const handleAmountChange = (value: string) => {
        // Remove any non-numeric characters except decimal point
        const sanitized = value.replace(/[^0-9.]/g, '');
        // Ensure only one decimal point
        const parts = sanitized.split('.');
        const cleaned = parts.length > 2 
            ? parts[0] + '.' + parts.slice(1).join('')
            : sanitized;
        // Limit decimal places
        if (cleaned.includes('.')) {
            const [intPart, decPart] = cleaned.split('.');
            if (decPart && decPart.length > selectedAsset.decimals) {
                setAmount(intPart + '.' + decPart.substring(0, selectedAsset.decimals));
                return;
            }
        }
        setAmount(cleaned);
    };

    // Use the ready count from pending withdrawals component
    // This is updated when MessageManager checks are complete
    // Only show count after mount to prevent hydration mismatches
    const pendingWithdrawalsCount = isMounted ? readyWithdrawalsCount : 0;

    // Merge dynamic APY into selected asset
    // Don't use hardcoded asset.apy - only use fetched data or show "..."
    const currentApy = apys[selectedAsset.symbol];
    const currentTvl = vaultMetrics.tvl || selectedAsset.tvl;

    // Create displayAsset but override apy with dynamic values.
    // When "Normal bridging without yield" is enabled, show 0% APY.
    // Show "..." when loading, otherwise show fetched APY or nothing
    const displayApy = isYieldEnabled
        ? (loadingApy || isLoadingVaultMetrics ? "..." : (currentApy || "..."))
        : "0%";

    // TVL represents value bridged through the selected vault (normal or yield)
    // For yield vaults on L2 (withdraw tab), show l2ValueSymbol instead of base symbol
    const displaySymbol = (isYieldEnabled && activeTab === "withdraw") 
        ? (selectedAsset.l2ValueSymbol || `v${selectedAsset.symbol}`)
        : selectedAsset.symbol;
    
    // Unit for amount input - use l2ValueSymbol for withdrawal with yield
    const amountUnit = (isYieldEnabled && activeTab === "withdraw")
        ? (selectedAsset.l2ValueSymbol || `v${selectedAsset.symbol}`)
        : selectedAsset.symbol;
    
    const displayAsset = {
        ...selectedAsset,
        symbol: displaySymbol,
        apy: displayApy,
        tvl: isLoadingVaultMetrics ? "..." : currentTvl
    };

    // Auto-switch network when wallet is connected but on the wrong network
    // Skip auto-switch if pending withdrawal modal is open
  useEffect(() => {
    if (!needsSwitch) {
      setAutoSwitchFailed(false);
      return;
    }

    setIsAutoSwitching(true);
    setAutoSwitchFailed(false);

    switchChain({ chainId: targetChainId }).then(() => {
      setIsAutoSwitching(false);
    }).catch((error) => {
      console.error(`Auto-switch to ${targetChainName} failed:`, error);
      setAutoSwitchFailed(true);
    });
  }, [needsSwitch, targetChainId, switchChain, targetChainName]);

  // Fetch transactions when chain changes to correct network
  useEffect(() => {
    // Only fetch when on the correct network for the current tab
    const isOnCorrectNetwork = currentChainId === targetChainId;

    if (!isMetamaskConnected || !isOnCorrectNetwork) return;

    // For EVM wallets, the same address works on both Ethereum and Via Network
    // Use whichever address is available (they're the same underlying address anyways)
    const store = useWalletStore.getState();
    const connectedEvmAddress = store.l1Address || store.viaAddress;

    if (connectedEvmAddress) {
      fetchEthTransactions();
    }
  }, [currentChainId, activeTab, isMetamaskConnected, fetchEthTransactions]);

    // Reset amount when switching tabs
    useEffect(() => {
        setAmount("");
    }, [activeTab]);

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
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">Via Ethereum Network Bridge</h1>
                        <p className="text-sm text-slate-600">Bridge assets securely</p>
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
                            exchangeRate={isLoadingVaultMetrics ? "..." : exchangeRateDisplay || undefined}
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
                                    onChange={handleAmountChange} 
                                    onMax={handleMaxAmount} 
                                    unit={amountUnit} 
                                    maxDisabled={!balance || parseFloat(balance) <= 0}
                                />
                            </div>
                        )}

                        {/* Balance Display */}
                        <div className="mb-6">
                            <AvailableBalanceDisplay 
                                balance={balance} 
                                unit={amountUnit} 
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
                                    unit={amountUnit}
                                    decimals={selectedAsset.decimals}
                                />
                            </div>
                        )}

                        {/* Expected amount to receive (for withdrawal with yield) */}
                        {activeTab === "withdraw" && isYieldEnabled && expectedAmountData && amountNumber > 0 && (
                            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Expected to receive:</span>
                                        <span className="font-semibold text-blue-700">
                                            {expectedAmountData.outputAmount} {selectedAsset.symbol}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground pt-1 border-t border-blue-200">
                                        <div className="flex items-center gap-1">
                                            <span>{expectedAmountData.inputAmount} {selectedAsset.l2ValueSymbol || `v${selectedAsset.symbol}`}</span>
                                            <span>×</span>
                                            <span>{expectedAmountData.displayRate}</span>
                                            <span>=</span>
                                            <span className="font-medium">{expectedAmountData.outputAmount} {selectedAsset.symbol}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Form Content */}
                        {activeTab === "deposit" ? (
                            isMetamaskConnected ? (
                                    isAutoSwitching || isSwitchingNetwork ? (
                                        <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            <p className="text-sm text-muted-foreground">
                                                Switching to {targetChainName} network...
                                            </p>
                                        </div>
                                ) : (!isCorrectL1Network || autoSwitchFailed) ? (
                                    <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                                        <div className="rounded-full bg-amber-100 p-4">
                                            <AlertCircle className="h-8 w-8 text-amber-600" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="font-semibold">Switch to {targetChainName}</h3>
                                            <p className="text-sm text-muted-foreground max-w-[250px]">
                                                {autoSwitchFailed 
                                                    ? "Automatic network switch failed. Please switch manually."
                                                    : `Your wallet is connected. Please switch to ${targetChainName} network to continue.`}
                                            </p>
                                        </div>
                                        <Button 
                                            onClick={async () => {
                                                setIsAutoSwitching(true);
                                                try {
                                                    await switchChain({ chainId: targetChainId });
                                                    await checkL1Network();
                                                    setAutoSwitchFailed(false);
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
                                                `Switch to ${targetChainName}`
                                            )}
                                        </Button>
                                    </div>
                                ) : (
                                    <EthereumDepositForm
                                        asset={displayAsset}
                                        isYield={isYieldEnabled}
                                        amount={amount}
                                        onAmountReset={() => setAmount("")}
                                        exchangeRate={vaultMetrics.exchangeRate}
                                        onBalanceRefresh={refetch}
                                    />
                                )
                            ) : (
                                <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-slate-50/50 rounded-xl border border-border/50">
                                    <div className="text-center space-y-2">
                                        <h3 className="text-xl font-semibold">Connect EVM Wallet</h3>
                                        <p className="text-sm text-muted-foreground max-w-[280px]">
                                            EVM wallet connection is required to deposit from Ethereum to Via network
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
                                                Switching to {targetChainName} network...
                                            </p>
                                        </div>
                                    ) : (!isCorrectViaNetwork || autoSwitchFailed) ? (
                                        <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                                            <div className="rounded-full bg-amber-100 p-4">
                                                <AlertCircle className="h-8 w-8 text-amber-600" />
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className="font-semibold">Switch to {targetChainName}</h3>
                                                <p className="text-sm text-muted-foreground max-w-[250px]">
                                                    {autoSwitchFailed 
                                                        ? "Automatic network switch failed. Please switch manually."
                                                        : `Your wallet is connected. Please switch to ${targetChainName} to continue.`}
                                                </p>
                                            </div>
                                            <Button 
                                                onClick={async () => {
                                                    setIsAutoSwitching(true);
                                                    try {
                                                        await switchChain({ chainId: targetChainId });
                                                        await checkMetamaskNetwork();
                                                        setAutoSwitchFailed(false);
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
                                                    `Switch to ${targetChainName}`
                                                )}
                                            </Button>
                                        </div>
                                    ) : (
                                        <EthereumWithdrawForm
                                            asset={selectedAsset}
                                            isYield={isYieldEnabled}
                                            amount={amount}
                                            onAmountReset={() => setAmount("")}
                                            exchangeRate={vaultMetrics.exchangeRate}
                                            onBalanceRefresh={refetch}
                                        />
                                    )
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-8 space-y-4 bg-slate-50/50 rounded-xl border border-border/50">
                                        <div className="text-center space-y-2">
                                            <h3 className="text-xl font-semibold">Connect EVM Wallet</h3>
                                            <p className="text-sm text-muted-foreground max-w-[280px]">
                                                EVM wallet connection is required to withdraw from Via to Ethereum network
                                            </p>
                                        </div>
                                        <WalletConnectButton />
                                    </div>
                                )}
                            </>
                        )}

                        {/* Transaction History */}
                        {isMetamaskConnected && (
                            <div className="mt-8">
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
                                        <TransactionHistory 
                                            isLoading={isLoadingTransactions} 
                                            onRefresh={fetchEthTransactions} 
                                            transactions={ethTransactions}
                                            excludeSymbol="BTC"
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
