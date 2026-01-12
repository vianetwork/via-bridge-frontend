import { ethers, getAddress, BrowserProvider } from "ethers";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import AddressFieldWithWallet from "@/components/address-field-with-wallet";
import { ERC20_ABI, VAULT_ABI } from "@/services/ethereum/abis";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Loader2, Wallet, AlertCircle, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { SUPPORTED_ASSETS, getAssetAddress } from "@/services/ethereum/config";
import { EthereumSepolia } from "@/lib/wagmi/chains";
import { useWalletStore } from "@/store/wallet-store";
import { useWalletState } from "@/hooks/use-wallet-state";
import { ensureEthereumNetwork } from "@/utils/ensure-network";
import ApprovalModal from "@/components/approval-modal";
import { getWalletDisplayMetaByRdns } from "@/utils/wallet-metadata";
import { NETWORKS } from "@/services/bridge/networks";



interface EthereumDepositFormProps {
    asset: typeof SUPPORTED_ASSETS[0];
    isYield: boolean;
    amount: string;
    onAmountReset?: () => void;
    exchangeRate?: string | null; // Raw exchange rate for calculating toAmount
    onBalanceRefresh?: () => void; // Callback to refresh parent balance
}

const createDepositFormSchema = (balance: string | null, minAmount: string = "0.000001", decimals: number = 6) => z.object({
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
    }, "Invalid Ethereum/Via address"),
});

export default function EthereumDepositForm({ asset, isYield, amount, onAmountReset, exchangeRate, onBalanceRefresh }: EthereumDepositFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<string>(""); // For displaying "Approving..." or "Depositing..."
    const [balance, setBalance] = useState<string | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
    const [approvalOpen, setApprovalOpen] = useState(false);

    const { addLocalTransaction, selectedWallet } = useWalletStore();
    const { isL1Connected, connectL1Wallet, l1Address, isCorrectL1Network, isMetamaskConnected, viaAddress } = useWalletState();
    
    // Get wallet name from selected wallet
    const walletMeta = selectedWallet ? getWalletDisplayMetaByRdns(selectedWallet) : null;
    const walletName = walletMeta?.name || "Wallet";

    const form = useForm<z.infer<ReturnType<typeof createDepositFormSchema>> & { _balance?: string }>({
        resolver: zodResolver(createDepositFormSchema(balance, asset.minAmount || "0.000001", asset.decimals)),
        mode: "onChange", // Validate on change to update isValid state
        defaultValues: {
            amount: amount || "",
            recipientAddress: "", // Will be autofilled
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

    // Calculate expected amount to receive for deposit (base symbol -> l2ValueSymbol)
    const expectedAmountData = useMemo(() => {
        if (!isYield || !amount || !exchangeRate) {
            return null;
        }

        try {
            const rate = parseFloat(exchangeRate);
            if (isNaN(rate) || rate === 0) return null;
            
            const amountNumber = parseFloat(amount);
            if (isNaN(amountNumber) || amountNumber <= 0) return null;
            
            // For deposit: USDC -> vUSDC, so we use the exchange rate directly
            const expected = amountNumber * rate;
            return {
                expected: expected.toFixed(asset.decimals),
                rate: rate.toFixed(6),
                inputAmount: amountNumber.toFixed(asset.decimals)
            };
        } catch (error) {
            console.error("Error calculating expected amount:", error);
            return null;
        }
    }, [isYield, amount, exchangeRate, asset.decimals]);

    // Get the address to use for balance checking (prefer l1Address, fallback to viaAddress)
    const walletAddress = l1Address || viaAddress;
    const isFetchingRef = useRef(false);
    
    // Extract token address to a stable reference for useCallback dependency
    const tokenAddress = getAssetAddress(asset);

    // Fetch Balance function - extracted to be reusable
    const fetchBalance = useCallback(async () => {
        // Need wallet address, correct network, and asset address
        if (!walletAddress || !isCorrectL1Network || !tokenAddress) return;

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
            const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, browserProvider);
            const bal = await tokenContract.balanceOf(walletAddress);
            const balFormatted = ethers.formatUnits(bal, asset.decimals);
            setBalance(balFormatted);
        } catch (err) {
            console.error("Error fetching balance:", err);
            setBalance(null);
            } finally {
                isFetchingRef.current = false;
            }
    }, [walletAddress, isCorrectL1Network, tokenAddress, asset.decimals]);

    // Fetch Balance - use stable dependencies to prevent spam
    useEffect(() => {
        fetchBalance();
        // Use stable dependencies: only wallet address, network state, asset symbol and address
    }, [fetchBalance]);


    async function onSubmit(values: z.infer<ReturnType<typeof createDepositFormSchema>>) {
        try {
            setIsSubmitting(true);
            setApprovalOpen(true);
            setStatus("Initializing...");

            // 1. Setup read-only provider for allowance checks
            const readProvider = new ethers.JsonRpcProvider(EthereumSepolia.rpcUrls.default.http[0]);

            // 2. Ensure network is correct and get provider/signer
            setStatus("Checking network...");
            const networkResult = await ensureEthereumNetwork();
            if (!networkResult.success || !networkResult.provider || !networkResult.signer) {
                throw new Error(networkResult.error || "Please switch your wallet to Sepolia network manually.");
            }

            const { signer } = networkResult;

            // 3. Determine addresses
            const tokenAddress = getAssetAddress(asset);
            const vaultAddress = isYield ? asset.vaultAddresses.ethereum.yieldBearing : asset.vaultAddresses.ethereum.standard;

            if (!tokenAddress || !vaultAddress) {
                throw new Error("Configuration missing for this asset/network");
            }

            const tokenContractRead = new ethers.Contract(tokenAddress, ERC20_ABI, readProvider);
            const userAddress = await signer.getAddress();
            const recipient = values.recipientAddress;

            console.log(`[Deposit] Token: ${tokenAddress}, Vault: ${vaultAddress}, User: ${userAddress}, Recipient: ${recipient}`);

            // 4. Parse amount & Check Allowance (READ ONLY - Robust)
            const decimals = asset.decimals;
            // Limit decimal places to prevent underflow
            const amountStr = parseFloat(values.amount).toFixed(decimals);
            const amountBN = ethers.parseUnits(amountStr, decimals);

            setStatus("Checking allowance...");
            const allowance = await tokenContractRead.allowance(userAddress, vaultAddress);
            console.log(`[Deposit] Allowance: ${allowance.toString()}, Required: ${amountBN.toString()}`);

            // 5. Execute Transactions
            if (allowance < amountBN) {
                const tokenContractWrite = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
                setStatus("Approving token...");

                const approveTx = await tokenContractWrite.approve(vaultAddress, amountBN);
                await approveTx.wait();
            }

            const vaultContractWrite = new ethers.Contract(vaultAddress, VAULT_ABI, signer);

            setStatus("Depositing...");

            // Deposit to the specified recipient
            const tx = await vaultContractWrite.depositWithBridge(amountBN, recipient);
            setStatus("Waiting for confirmation...");
            await tx.wait();

            const explorerUrlValue = `https://sepolia.etherscan.io/tx/${tx.hash}`;
            setTxHash(tx.hash);
            setExplorerUrl(explorerUrlValue);
            setIsSuccess(true);

            addLocalTransaction({
                type: 'deposit',
                amount: values.amount,
                status: 'Pending',
                txHash: tx.hash,
                l1ExplorerUrl: explorerUrlValue,
                symbol: asset.symbol
            });

            toast.success("Deposit Submitted", {
                description: `Successfully deposited ${values.amount} ${asset.symbol}`,
            });

            // Reset amount after successful deposit
            if (onAmountReset) {
                onAmountReset();
            }

            // Refresh balance after successful deposit (both form and parent)
            await fetchBalance();
            if (onBalanceRefresh) {
                await onBalanceRefresh();
            }
        } catch (error: any) {
            console.error("Deposit error:", error);

            if (error.code === 'ACTION_REJECTED' || error.message?.includes('user rejected')) {
                toast.error("Transaction Rejected", { description: "User rejected the transaction." });
            } else if (error.code === 'BAD_DATA') {
                toast.error("Contract Error", { description: "Double check your network or token selection." });
            } else if (error.reason === '51' || error.message?.includes('51')) {
                toast.error("Supply Cap Exceeded", {
                    description: "The Yield Vault is full (Aave limit). Please uncheck 'Earn Yield' to use the Normal Vault.",
                    duration: 8000,
                });
            } else {
                toast.error("Deposit Failed", {
                    description: error.message || "Something went wrong. Please try again.",
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
            await connectL1Wallet();
        } catch (error) {
            console.error("Connection error:", error);
        } finally {
            setIsConnecting(false);
        }
    };

    // Check if EVM wallet is connected (regardless of network)
    // If connected but not on L1 or wrong network, just switch
    const isWalletConnected = isMetamaskConnected || isL1Connected;
    const needsNetworkSwitch = isWalletConnected && !isCorrectL1Network;

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
                                    <h3 className="text-2xl font-semibold tracking-tight">Deposit Transaction Submitted</h3>
                                    <p className="text-muted-foreground text-sm">
                                        Your deposit transaction has been submitted to the Sepolia network and it is being processed
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
                                    Make Another Deposit
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

    if (!isWalletConnected) {
        // Not connected at all - show connect button
        return (
            <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                <div className="rounded-full bg-primary/10 p-4">
                    <Wallet className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                    <h3 className="font-semibold">Connect EVM Wallet</h3>
                    <p className="text-sm text-muted-foreground max-w-[250px]">
                        {isConnecting 
                            ? "Connecting and switching to Sepolia..." 
                            : "EVM wallet connection is required to deposit from Ethereum to Via network. We'll automatically switch to Sepolia network."}
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

    if (needsNetworkSwitch) {
        // Connected but on wrong network - show switch button
        return (
            <div className="flex flex-col items-center justify-center space-y-4 py-8 text-center">
                <div className="rounded-full bg-amber-100 p-4">
                    <AlertCircle className="h-8 w-8 text-amber-600" />
                </div>
                <div className="space-y-2">
                    <h3 className="font-semibold">Switch to Sepolia</h3>
                    <p className="text-sm text-muted-foreground max-w-[250px]">
                        Your wallet is connected. Please switch to Sepolia network to continue.
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
                        "Switch to Sepolia"
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

                    {/* Expected amount to receive (for deposit with yield) */}
                    {isYield && expectedAmountData && parseFloat(amount || "0") > 0 && (
                        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Expected to receive:</span>
                                    <span className="font-semibold text-blue-700">
                                        {expectedAmountData.expected} {asset.l2ValueSymbol || `v${asset.symbol}`}
                                    </span>
                                </div>
                                <div className="text-xs text-muted-foreground pt-1 border-t border-blue-200">
                                    <div className="flex items-center gap-1">
                                        <span>{expectedAmountData.inputAmount} {asset.symbol}</span>
                                        <span>×</span>
                                        <span>{expectedAmountData.rate}</span>
                                        <span>=</span>
                                        <span className="font-medium">{expectedAmountData.expected} {asset.l2ValueSymbol || `v${asset.symbol}`}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <FormField
                        control={form.control}
                        name="recipientAddress"
                        render={({ field }) => (
                            <FormItem>
                                <AddressFieldWithWallet
                                    mode="via"
                                    label="Recipient Via Address"
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
                            "Deposit"
                        )}
                    </Button>
                </form>
            </Form>
            <ApprovalModal
                open={approvalOpen}
                onOpenChange={setApprovalOpen}
                onCancel={handleCancelTransfer}
                direction="deposit"
                title="Waiting for Approval"
                walletName={walletName}
                transactionData={{
                    fromAmount: form.watch("amount") || "0",
                    toAmount: (() => {
                        // Calculate toAmount using exchange rate for yield deposits
                        if (isYield && exchangeRate) {
                            try {
                                const rate = parseFloat(exchangeRate);
                                if (!isNaN(rate) && rate > 0) {
                                    const fromAmount = parseFloat(form.watch("amount") || "0");
                                    // For deposit: base symbol -> l2ValueSymbol, so we use the exchange rate directly
                                    const toAmount = fromAmount * rate;
                                    return toAmount.toFixed(asset.decimals);
                                }
                            } catch (error) {
                                console.error("Error calculating toAmount:", error);
                            }
                        }
                        // For normal deposits or if exchange rate not available, use same amount
                        return form.watch("amount") || "0";
                    })(),
                    fromToken: {
                        symbol: asset.symbol, // Always USDC (the actual token being deposited)
                        name: asset.name,
                        decimals: asset.decimals,
                        icon: asset.icon,
                    },
                    toToken: {
                        symbol: isYield ? (asset.l2ValueSymbol || `v${asset.symbol}`) : asset.symbol, // l2ValueSymbol for yield, base symbol for normal
                        name: isYield ? `v${asset.name}` : asset.name,
                        decimals: asset.decimals,
                        icon: asset.icon,
                    },
                    fromNetwork: {
                        id: 'ethereum-sepolia',
                        displayName: 'Ethereum Sepolia',
                        chainId: 11155111,
                        type: 'evm' as const,
                        icon: '/ethereum-logo.png',
                    },
                    toNetwork: NETWORKS.VIA_TESTNET,
                    recipientAddress: form.watch("recipientAddress") || "",
                }}
            />
        </>
    );
}
