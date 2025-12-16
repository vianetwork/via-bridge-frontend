"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Wallet, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { SUPPORTED_ASSETS } from "@/services/ethereum/config";
import { useWalletStore } from "@/store/wallet-store";
import { useWalletState } from "@/hooks/use-wallet-state";
import { ensureViaNetwork } from "@/utils/ensure-network";
import { ethers, getAddress } from "ethers";
import { FormAmountSlider } from "@/components/form-amount-slider";
import AddressFieldWithWallet from "@/components/address-field-with-wallet";
import { cn } from "@/lib/utils";
import { ERC20_ABI, VAULT_ABI } from "@/services/ethereum/abis";
import { getNetworkConfig } from "@/services/config";

interface EthereumWithdrawFormProps {
    asset: typeof SUPPORTED_ASSETS[0];
    isYield: boolean;
}

const withdrawFormSchema = z.object({
    amount: z.string().refine((val) => {
        const n = parseFloat(val);
        return !isNaN(n) && n > 0;
    }, "Amount must be greater than 0"),
    recipientAddress: z.string().refine((val) => {
        try {
            return !!getAddress(val);
        } catch {
            return false;
        }
    }, "Invalid Ethereum address"),
});

export default function EthereumWithdrawForm({ asset, isYield }: EthereumWithdrawFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<string>("");
    const [balance, setBalance] = useState<string | null>(null);
    const [isLoadingBalance, setIsLoadingBalance] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [explorerUrl, setExplorerUrl] = useState<string | null>(null);

    const { addLocalTransaction } = useWalletStore();
    const { isMetamaskConnected, viaAddress, connectMetamask, isCorrectViaNetwork } = useWalletState();

    const form = useForm<z.infer<typeof withdrawFormSchema> & { _balance?: string }>({
        resolver: zodResolver(withdrawFormSchema),
        defaultValues: {
            amount: "",
            recipientAddress: "",
        },
    });

    // Update form balance when state changes
    useEffect(() => {
        if (balance) {
            form.setValue("_balance", balance);
        }
    }, [balance, form]);

    // Fetch Balance from L2
    const fetchBalance = useCallback(async () => {
        // Need wallet address, correct network, and vault contract
        if (!viaAddress || !isCorrectViaNetwork) return;

        try {
            setIsLoadingBalance(true);
            const networkConfig = getNetworkConfig();
            const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrls[0]);

            // Check L2 balance
            const targetContract = isYield ? asset.vaults.l2.yield : asset.vaults.l2.normal;

            if (!targetContract) {
                setBalance(null);
                return;
            }

            const tokenContract = new ethers.Contract(targetContract, ERC20_ABI, provider);
            const bal = await tokenContract.balanceOf(viaAddress);
            const balFormatted = ethers.formatUnits(bal, asset.decimals);
            setBalance(balFormatted);
        } catch (err) {
            console.error("Error fetching L2 balance:", err);
            setBalance(null);
        } finally {
            setIsLoadingBalance(false);
        }
    }, [viaAddress, isCorrectViaNetwork, asset, isYield]);

    // Initial fetch and refresh on dependencies change
    useEffect(() => {
        fetchBalance();
    }, [fetchBalance]);

    // Periodic refresh every 10 seconds
    useEffect(() => {
        if (!viaAddress || !isCorrectViaNetwork) return;

        const interval = setInterval(() => {
            fetchBalance();
        }, 10000); // Refresh every 10 seconds

        return () => clearInterval(interval);
    }, [viaAddress, isCorrectViaNetwork, fetchBalance]);

    // Refresh when tab becomes visible
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && viaAddress && isCorrectViaNetwork) {
                fetchBalance();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [viaAddress, isCorrectViaNetwork, fetchBalance]);


    async function onSubmit(values: z.infer<typeof withdrawFormSchema>) {
        try {
            setIsSubmitting(true);
            setStatus("Initializing...");

            // Ensure network is correct and get provider/signer
            setStatus("Checking network...");
            const networkResult = await ensureViaNetwork();
            if (!networkResult.success || !networkResult.provider || !networkResult.signer) {
                throw new Error(networkResult.error || "Please switch your wallet to Via Network manually.");
            }

            const { signer } = networkResult;
            const networkConfig = getNetworkConfig();

            // 2. Withdraw interaction
            // Contract: L2 Vault
            const vaultAddress = isYield ? asset.vaults.l2.yield : asset.vaults.l2.normal;
            if (!vaultAddress) {
                throw new Error("L2 Vault address not configured");
            }

            const vaultContract = new ethers.Contract(vaultAddress, VAULT_ABI, signer);

            setStatus("Withdrawing...");
            const decimals = asset.decimals;
            const amountBN = ethers.parseUnits(values.amount, decimals);

            // Call withdraw(shares, receiver)
            // Note: We use "shares" which maps to the token amount for 1:1 assets,
            // or the component should ideally handle share conversion if different.
            // For now assuming 1:1 or user input is treated as shares.
            const tx = await vaultContract.withdraw(amountBN, values.recipientAddress);

            setStatus("Waiting for confirmation...");
            await tx.wait();

            const explorerUrlValue = `${networkConfig.blockExplorerUrls?.[0]}/tx/${tx.hash}`;
            setTxHash(tx.hash);
            setExplorerUrl(explorerUrlValue);
            setIsSuccess(true);

            addLocalTransaction({
                type: 'withdraw',
                amount: values.amount,
                status: 'Pending',
                txHash: tx.hash,
                l2ExplorerUrl: explorerUrlValue,
                symbol: asset.symbol
            });

            toast.success("Withdrawal Submitted", {
                description: `Withdrawing ${values.amount} ${asset.symbol}`,
            });

            // Refresh balance after successful withdrawal
            await fetchBalance();
        } catch (error: any) {
            console.error("Withdrawal error:", error);
            if (error?.code === 'ACTION_REJECTED' || error?.message?.includes('user rejected')) {
                toast.error("Transaction Rejected");
            } else {
                toast.error("Withdrawal Failed", {
                    description: error.message || "Something went wrong.",
                });
            }
        } finally {
            setIsSubmitting(false);
            setStatus("");
        }
    }

    const handleConnect = async () => {
        try {
            setIsConnecting(true);
            await connectMetamask();
        } catch (error) {
            console.error("Connection error:", error);
        } finally {
            setIsConnecting(false);
        }
    };

    if (isSuccess && txHash && explorerUrl) {
        return (
            <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
                <div className="w-full max-w-md p-4">
                    <div className="bg-background border border-border/50 rounded-lg shadow-lg p-6">
                        <div className="space-y-8">
                            <div className="text-center space-y-4">
                                <div className="h-16 w-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto ring-1 ring-green-500/30">
                                    <svg
                                        className="h-8 w-8"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-semibold tracking-tight">Withdrawal Transaction Submitted</h3>
                                    <p className="text-muted-foreground text-sm">
                                        Your withdrawal transaction has been submitted to the VIA network and it is being processed.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-muted/50 rounded-lg p-4 space-y-4 border border-border/50">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium">Transaction Hash</p>
                                        <a
                                            href={explorerUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium"
                                        >
                                            View on Explorer
                                            <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                    </div>
                                    <p className="font-mono text-xs bg-background/80 p-3 rounded-md break-all text-muted-foreground">
                                        {txHash}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 space-y-1">
                                        <p className="text-sm font-medium text-blue-900">
                                            Next Steps
                                        </p>
                                        <p className="text-xs text-blue-700 leading-relaxed">
                                            You can withdraw again immediately. When your withdrawal is ready to claim, 
                                            it will appear in the <span className="font-semibold">Pending Withdrawals</span> modal automatically.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <Button
                                    className="w-full"
                                    onClick={() => {
                                        setIsSuccess(false);
                                        setTxHash(null);
                                        setExplorerUrl(null);
                                        form.reset();
                                    }}
                                >
                                    Make Another Withdrawal
                                </Button>
                                <a
                                    href={explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full"
                                >
                                    <Button variant="outline" className="w-full">
                                        Track Transaction
                                        <ExternalLink className="ml-2 h-4 w-4" />
                                    </Button>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!isMetamaskConnected) {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                <div className="rounded-full bg-primary/10 p-4">
                    <Wallet className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                    <h3 className="font-semibold">Connect EVM Wallet</h3>
                    <p className="text-sm text-muted-foreground max-w-[250px]">
                        {isConnecting 
                            ? "Connecting and switching to VIA network..." 
                            : "EVM wallet connection is required to withdraw from VIA to Ethereum network. We'll automatically switch to VIA network."}
                    </p>
                </div>
                <Button 
                    onClick={handleConnect} 
                    className="w-full max-w-[200px]"
                    disabled={isConnecting}
                >
                    {isConnecting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Connecting...
                        </>
                    ) : (
                        "Connect Wallet"
                    )}
                </Button>
            </div>
        );
    }

    // Show warning if connected but on wrong network (shouldn't happen with auto-switch, but just in case)
    if (isMetamaskConnected && !isCorrectViaNetwork) {
        return (
            <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                <div className="rounded-full bg-amber-100 p-4">
                    <AlertCircle className="h-8 w-8 text-amber-600" />
                </div>
                <div className="space-y-2">
                    <h3 className="font-semibold">Wrong Network</h3>
                    <p className="text-sm text-muted-foreground max-w-[250px]">
                        Please switch to VIA network to continue.
                    </p>
                </div>
                <Button 
                    onClick={handleConnect} 
                    className="w-full max-w-[200px]"
                    disabled={isConnecting}
                >
                    {isConnecting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Switching...
                        </>
                    ) : (
                        "Switch to VIA Network"
                    )}
                </Button>
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem>
                            <div className="flex justify-between items-center">
                                <FormLabel className="text-sm">Amount ({asset.symbol})</FormLabel>
                            </div>
                            <FormControl>
                                <div className="relative">
                                    <Input
                                        placeholder="0.00"
                                        step="any"
                                        type="number"
                                        className={cn(
                                            "placeholder:text-muted-foreground/60 pr-16",
                                            field.value && balance && parseFloat(field.value) > parseFloat(balance) && "border-red-500 focus-visible:ring-red-500"
                                        )}
                                        {...field}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (balance) {
                                                form.setValue("amount", balance, { shouldValidate: true });
                                            }
                                        }}
                                        disabled={isLoadingBalance || !balance || parseFloat(balance) <= 0}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-100 text-blue-600 hover:bg-blue-200 disabled:opacity-50 mr-2"
                                    >
                                        MAX
                                    </button>
                                </div>
                            </FormControl>
                            {balance && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                    Vault Balance:{" "}
                                    {isLoadingBalance ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <span className={cn("font-medium", field.value && parseFloat(field.value) > parseFloat(balance) && "text-red-500")}>
                                            {parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 6 })} {asset.symbol}
                                        </span>
                                    )}
                                </div>
                            )}

                            {balance && parseFloat(balance) > 0 && (
                                <FormAmountSlider
                                    form={form}
                                    name="amount"
                                    balance={parseFloat(balance)}
                                    min={0}
                                    feeReserve={0}
                                    isLoading={isLoadingBalance}
                                    unit={asset.symbol}
                                    decimals={asset.decimals}
                                    ariaLabel={`Withdraw ${asset.symbol} amount`}
                                />
                            )}
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="recipientAddress"
                    render={({ field }) => (
                        <FormItem>
                            <AddressFieldWithWallet
                                mode="via" // Changed to via to avoid L1 network enforcement
                                label="Recipient (L1 Ethereum Address)"
                                placeholder="0x..."
                                value={field.value || ""}
                                onChange={field.onChange}
                            />
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {status || "Processing..."}
                        </>
                    ) : (
                        "Withdraw"
                    )}
                </Button>
            </form>
        </Form>
    );
}
