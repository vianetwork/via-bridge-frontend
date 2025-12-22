import { ethers, getAddress } from "ethers";
import { useState, useEffect, useRef } from "react";
import AddressFieldWithWallet from "@/components/address-field-with-wallet";
import { FormAmountSlider } from "@/components/form-amount-slider";
import { cn } from "@/lib/utils";
import { ERC20_ABI, VAULT_ABI } from "@/services/ethereum/abis";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Wallet, AlertCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { SUPPORTED_ASSETS, EthereumNetwork, ETHEREUM_NETWORK_CONFIG } from "@/services/ethereum/config";
import { useWalletStore } from "@/store/wallet-store";
import { useWalletState } from "@/hooks/use-wallet-state";
import { ensureEthereumNetwork } from "@/utils/ensure-network";



interface EthereumDepositFormProps {
    asset: typeof SUPPORTED_ASSETS[0];
    isYield: boolean;
}

const depositFormSchema = z.object({
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
    }, "Invalid Ethereum/Via address"),
});

export default function EthereumDepositForm({ asset, isYield }: EthereumDepositFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<string>(""); // For displaying "Approving..." or "Depositing..."
    const [balance, setBalance] = useState<string | null>(null);
    const [isLoadingBalance, setIsLoadingBalance] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [explorerUrl, setExplorerUrl] = useState<string | null>(null);

    const { addLocalTransaction } = useWalletStore();
    const { isL1Connected, connectL1Wallet, l1Address, isCorrectL1Network, isMetamaskConnected, viaAddress } = useWalletState();

    const form = useForm<z.infer<typeof depositFormSchema> & { _balance?: string }>({
        resolver: zodResolver(depositFormSchema),
        defaultValues: {
            amount: "",
            recipientAddress: "", // Will be autofilled
        },
    });

    // Update form balance when state changes
    useEffect(() => {
        if (balance) {
            form.setValue("_balance", balance);
        }
    }, [balance, form]);

    // Get the address to use for balance checking (prefer l1Address, fallback to viaAddress)
    const walletAddress = l1Address || viaAddress;
    const isFetchingRef = useRef(false);

    // Fetch Balance - use stable dependencies to prevent spam
    useEffect(() => {
        async function fetchBalance() {
            // Need wallet address, correct network, and asset address
            if (!walletAddress || !isCorrectL1Network || !asset.addresses[EthereumNetwork.SEPOLIA]) return;

            // Prevent multiple simultaneous fetches
            if (isFetchingRef.current) return;
            isFetchingRef.current = true;

            try {
                setIsLoadingBalance(true);
                const provider = new ethers.JsonRpcProvider(ETHEREUM_NETWORK_CONFIG[EthereumNetwork.SEPOLIA].rpcUrls[0]);
                const tokenContract = new ethers.Contract(asset.addresses[EthereumNetwork.SEPOLIA], ERC20_ABI, provider);
                const bal = await tokenContract.balanceOf(walletAddress);
                const balFormatted = ethers.formatUnits(bal, asset.decimals);
                setBalance(balFormatted);
            } catch (err) {
                console.error("Error fetching balance:", err);
                setBalance(null);
            } finally {
                setIsLoadingBalance(false);
                isFetchingRef.current = false;
            }
        }

        fetchBalance();
        // Use stable dependencies: only wallet address, network state, asset symbol and address
    }, [walletAddress, isCorrectL1Network, asset.symbol, asset.addresses?.[EthereumNetwork.SEPOLIA], asset.decimals]);


    async function onSubmit(values: z.infer<typeof depositFormSchema>) {
        try {
            setIsSubmitting(true);
            setStatus("Initializing...");

            // 1. Setup read-only provider for allowance checks
            const sepoliaConfig = ETHEREUM_NETWORK_CONFIG[EthereumNetwork.SEPOLIA];
            const readProvider = new ethers.JsonRpcProvider(sepoliaConfig.rpcUrls[0]);

            // 2. Ensure network is correct and get provider/signer
            setStatus("Checking network...");
            const networkResult = await ensureEthereumNetwork(EthereumNetwork.SEPOLIA);
            if (!networkResult.success || !networkResult.provider || !networkResult.signer) {
                throw new Error(networkResult.error || "Please switch your wallet to Sepolia network manually.");
            }

            const { signer } = networkResult;

            // 3. Determine addresses
            const tokenAddress = asset.addresses[EthereumNetwork.SEPOLIA];
            const vaultAddress = isYield ? asset.vaults.l1.yield : asset.vaults.l1.normal;

            if (!tokenAddress || !vaultAddress) {
                throw new Error("Configuration missing for this asset/network");
            }

            const tokenContractRead = new ethers.Contract(tokenAddress, ERC20_ABI, readProvider);
            const userAddress = await signer.getAddress();
            const recipient = values.recipientAddress;

            console.log(`[Deposit] Token: ${tokenAddress}, Vault: ${vaultAddress}, User: ${userAddress}, Recipient: ${recipient}`);

            // 4. Parse amount & Check Allowance (READ ONLY - Robust)
            const decimals = asset.decimals;
            const amountBN = ethers.parseUnits(values.amount, decimals);

            setStatus("Checking allowance...");
            const allowance = await tokenContractRead.allowance(userAddress, vaultAddress);
            console.log(`[Deposit] Allowance: ${allowance.toString()}, Required: ${amountBN.toString()}`);

            // 5. Execute Transactions
            if (allowance < amountBN) {
                const tokenContractWrite = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
                setStatus("Approving token...");
                toast.info("Approval Required", { description: "Please approve the token spend." });

                const approveTx = await tokenContractWrite.approve(vaultAddress, amountBN);
                await approveTx.wait();
                toast.success("Approved", { description: "Token approval successful." });
            }

            const vaultContractWrite = new ethers.Contract(vaultAddress, VAULT_ABI, signer);

            setStatus("Depositing...");
            toast.info("Sign Transaction", { description: "Please sign the deposit transaction." });

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
            setStatus("");
        }
    }

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
                            : "EVM wallet connection is required to deposit from Ethereum to VIA network. We'll automatically switch to Sepolia network."}
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
                                    Balance:{" "}
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
                                    feeReserve={0} // No fee reserve needed for ERC20 usually, user needs ETH for gas
                                    isLoading={isLoadingBalance}
                                    unit={asset.symbol}
                                    decimals={asset.decimals}
                                    ariaLabel={`Deposit ${asset.symbol} amount`}
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
                                mode="via"
                                label="Recipient VIA Address"
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
                        "Deposit"
                    )}
                </Button>
            </form>
        </Form>
    );
}
