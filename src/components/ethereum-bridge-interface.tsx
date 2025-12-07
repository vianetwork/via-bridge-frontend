"use client";

import { useState } from "react";
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
import { SUPPORTED_ASSETS } from "@/services/ethereum/config";
import EthereumDepositForm from "@/components/ethereum-deposit-form";
import EthereumWithdrawForm from "@/components/ethereum-withdraw-form";
import { useWalletState } from "@/hooks/use-wallet-state";
import WalletConnectButton from "@/components/wallet-connect-button";
import { TransactionHistory } from "@/components/transaction-history";
import { useWalletStore } from "@/store/wallet-store";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import { CardFooter } from "@/components/ui/card";
// Remove Label as it is no longer used in this file? Wait, check usage.
// Label is imported on line 14: import { Label } from "@/components/ui/label";
// I will check if Label is used elsewhere. It is used in the "Yield Toggle" section: <Label htmlFor="yield-mode" ...>
// So I keep Label import.


export default function EthereumBridgeInterface() {
    const [activeTab, setActiveTab] = useState<string>("deposit");
    const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string>(SUPPORTED_ASSETS[0].symbol);
    const [isYieldEnabled, setIsYieldEnabled] = useState<boolean>(true);
    const [showTransactions, setShowTransactions] = useState(false);

    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const { isMetamaskConnected, connectMetamask, disconnectMetamask } = useWalletState();
    const { transactions, isLoadingTransactions, fetchTransactions } = useWalletStore();

    const selectedAsset = SUPPORTED_ASSETS.find(a => a.symbol === selectedAssetSymbol) || SUPPORTED_ASSETS[0];

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
                            {SUPPORTED_ASSETS.map((asset) => (
                                <div
                                    key={asset.symbol}
                                    className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors hover:bg-slate-50 ${selectedAssetSymbol === asset.symbol ? 'border-primary bg-primary/5' : 'border-border'}`}
                                    onClick={() => {
                                        setSelectedAssetSymbol(asset.symbol);
                                        setIsDialogOpen(false);
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
                                        <p className="text-sm font-medium text-green-600">APY {asset.apy}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>

                <VaultCard
                    symbol={selectedAsset.symbol}
                    name={selectedAsset.name}
                    icon={selectedAsset.icon}
                    apy={selectedAsset.apy}
                    tvl={selectedAsset.tvl}
                    isSelected={true}
                    selectionHint="Change"
                    onClick={() => setIsDialogOpen(true)}
                />
            </div>

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
                                className="text-sm font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary transition-all duration-200 hover:bg-white/80"
                            >
                                Withdraw
                            </TabsTrigger>
                        </TabsList>

                        {/* Yield Toggle */}
                        <div className="flex items-center space-x-2 mb-6 justify-center">
                            <Checkbox
                                id="yield-mode"
                                checked={!isYieldEnabled}
                                onCheckedChange={(checked: boolean | 'indeterminate') => setIsYieldEnabled(checked === true)}
                            />
                            <Label htmlFor="yield-mode" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Normal bridging without yield
                            </Label>
                        </div>

                        <TabsContent value="deposit">
                            {isMetamaskConnected ? (
                                <EthereumDepositForm
                                    asset={selectedAsset}
                                    isYield={isYieldEnabled}
                                />
                            ) : (
                                <WalletConnectButton
                                    walletType="metamask"
                                    isConnected={isMetamaskConnected}
                                    onConnect={connectMetamask}
                                    onDisconnect={disconnectMetamask}
                                />
                            )}
                        </TabsContent>

                        <TabsContent value="withdraw">
                            {isMetamaskConnected ? (
                                <EthereumWithdrawForm
                                    asset={selectedAsset}
                                    isYield={isYieldEnabled}
                                />
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
                                {transactions.length > 0 && (
                                    <span className="bg-primary/10 text-primary text-xs rounded-full px-2 py-0.5">
                                        {transactions.length}
                                    </span>
                                )}
                            </div>
                            {showTransactions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>

                        {showTransactions && (
                            <div className="w-full mt-2">
                                <TransactionHistory isLoading={isLoadingTransactions} onRefresh={fetchTransactions} />
                            </div>
                        )}
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
