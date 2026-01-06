"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Loader2, Wallet, AlertCircle, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { SUPPORTED_ASSETS } from "@/services/ethereum/config";
import { useWalletStore } from "@/store/wallet-store";
import { useWalletState } from "@/hooks/use-wallet-state";
import { ensureViaNetwork } from "@/utils/ensure-network";
import { ethers, getAddress, BrowserProvider } from "ethers";
import AddressFieldWithWallet from "@/components/address-field-with-wallet";
import { ERC20_ABI, VAULT_ABI } from "@/services/ethereum/abis";
import { getNetworkConfig } from "@/services/config";
import ApprovalModal from "@/components/approval-modal";
import { getWalletDisplayMetaByRdns } from "@/utils/wallet-metadata";
import { NETWORKS } from "@/services/bridge/networks";

interface EthereumWithdrawFormProps {
    asset: typeof SUPPORTED_ASSETS[0];
    isYield: boolean;
    amount: string;
    onAmountReset?: () => void;
    exchangeRate?: string | null; // Raw exchange rate for calculating toAmount
    onBalanceRefresh?: () => void; // Callback to refresh parent balance
}

const createWithdrawFormSchema = (balance: string | null, minAmount: string = "0.000001", decimals: number = 6) => z.object({
    amount: z.string()
        .refine((val) => {
            // Check if it's a valid number (not empty, not just dots, etc.)
            if (!val || val.trim() === '' || val === '.' || val === '..') return false;
            const n = parseFloat(val);
            if (isNaN(n) || n <= 0) return false;
            // Limit decimal places to prevent underflow
            const decimalParts = val.split('.');
            if (decimalParts.length > 1 && decimalParts[1].length > decimals) {
                return false; // Too many decimals
            }
            return true;
        }, `Amount must be a valid number with at most ${decimals} decimal places`)
        .refine((val) => {
            const n = parseFloat(val);
            const min = parseFloat(minAmount);
            return !isNaN(n) && !isNaN(min) && n >= min;
        }, () => {
            return { message: `Minimum amount is ${minAmount}` };
        })
        .refine((val) => {
            if (!balance) return true; // If balance not loaded yet, allow validation to pass
            const n = parseFloat(val);
            const maxAmount = parseFloat(balance);
            return !isNaN(n) && !isNaN(maxAmount) && n <= maxAmount;
        }, () => {
            const maxAmount = parseFloat(balance || "0");
            return { message: `Amount exceeds balance. Maximum: ${maxAmount.toFixed(decimals)}` };
        }),
    recipientAddress: z.string().refine((val) => {
        try {
            return !!getAddress(val);
        } catch {
            return false;
        }
    }, "Invalid Ethereum address"),
});

export default function EthereumWithdrawForm({ asset, isYield, amount, onAmountReset, exchangeRate, onBalanceRefresh }: EthereumWithdrawFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<string>("");
    const [balance, setBalance] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
    const [approvalOpen, setApprovalOpen] = useState(false);

    const { addLocalTransaction, selectedWallet } = useWalletStore();
    const { isMetamaskConnected, viaAddress, connectMetamask, isCorrectViaNetwork } = useWalletState();
    
    // Get wallet name from selected wallet
    const walletMeta = selectedWallet ? getWalletDisplayMetaByRdns(selectedWallet) : null;
    const walletName = walletMeta?.name || "Wallet";

    const form = useForm<z.infer<ReturnType<typeof createWithdrawFormSchema>> & { _balance?: string }>({
        resolver: zodResolver(createWithdrawFormSchema(balance, asset.minAmount || "0.000001", asset.decimals)),
        mode: "onChange", // Validate on change to update isValid state
        defaultValues: {
            amount: amount || "",
            recipientAddress: "",
        },
    });

    // Update schema when balance changes
    useEffect(() => {
        form.clearErrors("amount");
        // Re-validate amount when balance changes
        if (amount) {
            form.trigger("amount");
        }
    }, [balance, form, amount]);

    // Update form amount when prop changes
    useEffect(() => {
        if (amount) {
            form.setValue("amount", amount, { shouldValidate: true });
        }
    }, [amount, form]);

    // Update form balance when state changes
    useEffect(() => {
        if (balance) {
            form.setValue("_balance", balance);
        }
    }, [balance, form]);

    const isFetchingRef = useRef(false);
    
    // Extract contract addresses to stable references for useCallback dependency
    const yieldVaultAddress = asset.vaultAddresses.via.yieldBearing;
    const normalVaultAddress = asset.vaultAddresses.via.standard;
    const targetContract = isYield ? yieldVaultAddress : normalVaultAddress;

    // Fetch Balance from L2 - use stable dependencies
    const fetchBalance = useCallback(async () => {
        // Compute target contract from stable addresses
        const targetContract = isYield ? yieldVaultAddress : normalVaultAddress;
        // Need wallet address, correct network, and vault contract
        if (!viaAddress || !isCorrectViaNetwork || !targetContract) return;

        // Prevent multiple simultaneous fetches
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        try {
            // Use browser wallet provider instead of RPC
            if (typeof window === "undefined" || !window.ethereum) {
                setBalance(null);
                return;
            }
            const browserProvider = new BrowserProvider(window.ethereum);
            const tokenContract = new ethers.Contract(targetContract, ERC20_ABI, browserProvider);
            const bal = await tokenContract.balanceOf(viaAddress);
            const balFormatted = ethers.formatUnits(bal, asset.decimals);
            setBalance(balFormatted);
        } catch (err) {
            console.error("Error fetching L2 balance:", err);
            setBalance(null);
            } finally {
                isFetchingRef.current = false;
            }
    }, [viaAddress, isCorrectViaNetwork, isYield, yieldVaultAddress, normalVaultAddress, asset.decimals]);

    // Initial fetch and refresh on dependencies change
    useEffect(() => {
        fetchBalance();
    }, [fetchBalance]);

    // Refresh when tab becomes visible - use stable dependencies
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && viaAddress && isCorrectViaNetwork && targetContract) {
                fetchBalance();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [viaAddress, isCorrectViaNetwork, targetContract, fetchBalance]);


    async function onSubmit(values: z.infer<ReturnType<typeof createWithdrawFormSchema>>) {
        try {
            setIsSubmitting(true);
            setApprovalOpen(true);
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
            const vaultAddress = isYield ? asset.vaultAddresses.via.yieldBearing : asset.vaultAddresses.via.standard;
            if (!vaultAddress) {
                throw new Error("L2 Vault address not configured");
            }

            const vaultContract = new ethers.Contract(vaultAddress, VAULT_ABI, signer);

            setStatus("Withdrawing...");
            const decimals = asset.decimals;
            // Limit decimal places to prevent underflow
            const amountStr = parseFloat(values.amount).toFixed(decimals);
            const amountBN = ethers.parseUnits(amountStr, decimals);

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

            // Reset amount after successful withdrawal
            if (onAmountReset) {
                onAmountReset();
            }

            // Refresh balance after successful withdrawal (both form and parent)
            await fetchBalance();
            if (onBalanceRefresh) {
                await onBalanceRefresh();
            }
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
            setApprovalOpen(false);
            setStatus("");
        }
    }

    const handleCancelTransfer = () => {
        setApprovalOpen(false);
        setIsSubmitting(false);
        setStatus("");
    };

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
            <div 
                className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        setIsSuccess(false);
                        setTxHash(null);
                        setExplorerUrl(null);
                        form.reset();
                    }
                }}
            >
                <div className="w-full max-w-md p-4">
                    <div className="bg-background border border-border/50 rounded-lg shadow-lg p-6 relative">
                        <button
                            onClick={() => {
                                setIsSuccess(false);
                                setTxHash(null);
                                setExplorerUrl(null);
                                form.reset();
                            }}
                            className="absolute top-4 right-4 p-1 rounded-md hover:bg-slate-100 transition-colors"
                            aria-label="Close"
                        >
                            <X className="h-5 w-5 text-slate-500" />
                        </button>
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
                                        Your withdrawal transaction has been submitted to the Via network and it is being processed.
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
                            ? "Connecting and switching to Via network..." 
                            : "EVM wallet connection is required to withdraw from Via to Ethereum network. We'll automatically switch to Via network."}
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
                        Please switch to Via network to continue.
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
                        "Switch to Via Network"
                    )}
                </Button>
            </div>
        );
    }

    return (
        <>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    {/* Amount is now handled by parent component */}
                    <FormField
                        control={form.control}
                        name="amount"
                        render={() => <input type="hidden" />}
                    />

                    <FormField
                        control={form.control}
                        name="recipientAddress"
                        render={({ field }) => (
                            <FormItem>
                                <AddressFieldWithWallet
                                    mode="ethereum" // Use ethereum mode for L1 address
                                    label="Recipient (L1 Ethereum Address)"
                                    placeholder="0x..."
                                    value={field.value || ""}
                                    onChange={(value) => {
                                        field.onChange(value);
                                        // Trigger validation when address changes
                                        form.trigger("recipientAddress");
                                    }}
                                />
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={
                            isSubmitting || 
                            !amount || 
                            parseFloat(amount) <= 0 ||
                            (balance && parseFloat(amount) > parseFloat(balance)) ||
                            !form.watch("recipientAddress") ||
                            !!form.formState.errors.recipientAddress ||
                            !!form.formState.errors.amount ||
                            !form.formState.isValid
                        }
                    >
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
            <ApprovalModal
                open={approvalOpen}
                onOpenChange={setApprovalOpen}
                onCancel={handleCancelTransfer}
                direction="withdraw"
                title="Waiting for Approval"
                walletName={walletName}
                transactionData={{
                    fromAmount: form.watch("amount") || "0",
                    toAmount: (() => {
                        // Calculate toAmount using exchange rate for yield withdrawals
                        if (isYield && exchangeRate) {
                            try {
                                const rate = parseFloat(exchangeRate);
                                if (!isNaN(rate) && rate > 0) {
                                    const fromAmount = parseFloat(form.watch("amount") || "0");
                                    const inverseRate = 1 / rate;
                                    const toAmount = fromAmount * inverseRate;
                                    return toAmount.toFixed(asset.decimals);
                                }
                            } catch (error) {
                                console.error("Error calculating toAmount:", error);
                            }
                        }
                        // For normal withdrawals or if exchange rate not available, use same amount
                        return form.watch("amount") || "0";
                    })(),
                    fromToken: {
                        // For yield: use l2ValueSymbol (asset.symbol might already be l2ValueSymbol from displaySymbol, so check first)
                        // For normal: ensure base symbol (remove v prefix if present)
                        symbol: isYield 
                            ? (asset.l2ValueSymbol || (asset.symbol.startsWith('v') ? asset.symbol : `v${asset.symbol}`))
                            : asset.symbol.replace(/^v/, ''), // l2ValueSymbol for yield, base symbol for normal
                        name: isYield 
                            ? (asset.l2ValueSymbol ? `v${asset.name}` : (asset.name.startsWith('v') ? asset.name : `v${asset.name}`))
                            : asset.name.replace(/^v/, ''),
                        decimals: asset.decimals,
                        icon: asset.icon,
                    },
                    toToken: {
                        // Always USDC (the actual token being received) - remove any v prefix
                        symbol: asset.symbol.replace(/^v/, ''),
                        name: asset.name.replace(/^v/, ''),
                        decimals: asset.decimals,
                        icon: asset.icon,
                    },
                    fromNetwork: NETWORKS.VIA_TESTNET,
                    toNetwork: {
                        id: 'ethereum-sepolia',
                        displayName: 'Ethereum Sepolia',
                        chainId: 11155111,
                        type: 'evm' as const,
                        icon: '/ethereum-logo.png',
                    },
                    recipientAddress: form.watch("recipientAddress") || "",
                }}
            />
        </>
    );
}
