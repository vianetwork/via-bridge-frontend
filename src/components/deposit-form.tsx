"use client";

import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ArrowRight, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { executeDeposit } from "@/services/bridge/deposit";
import { getBitcoinBalance } from "@/services/bitcoin/balance";
import Image from "next/image";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWalletStore } from "@/store/wallet-store";
import { isAddress } from "ethers";
import { SYSTEM_CONTRACTS_ADDRESSES_RANGE, L1_BTC_DECIMALS } from "@/services/constants";
import { cn } from "@/lib/utils";

interface DepositFormProps {
  bitcoinAddress: string | null
  bitcoinPublicKey: string | null
  onDisconnect: () => void
  onTransactionSubmitted: () => void;
}

interface FormContext {
  _balance?: string;
}

const depositFormSchema = z.object({
  amount: z
    .string()
    .refine((val) => !isNaN(Number.parseFloat(val)), {
      message: "Amount must be a valid number",
    })
    .refine((val) => Number.parseFloat(val) >= 0.0002, {
      message: "Minimum amount is 0.0002 BTC (1000 satoshis)",
    })
    .superRefine((val, ctx) => {
      // Get balance from context
      const formValues = ctx.path[0] as FormContext;
      const balance = formValues?._balance ? parseFloat(formValues._balance) : 0;

      // Skip validation if no balance available
      if (balance <= 0) return;

      // Check if amount exceeds balance
      if (Number.parseFloat(val) > balance) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Amount exceeds available balance",
        });
      }
    }),
  recipientViaAddress: z
    .string()
    .min(1, { message: "VIA address is required" })
    .refine((val) => {
      return verifyRecipientAddress(val);
    }, {
      message: "Invalid recipient address.",
    }),
});

const verifyRecipientAddress = (address: string): boolean => {
  if (!isAddress(address)) {
    return false;
  }
  // Check if the recipientAddress is not a system contract address
  const invalidReceiverBn = BigInt(SYSTEM_CONTRACTS_ADDRESSES_RANGE);
  const recipientAddressBn = BigInt(address);
  return recipientAddressBn > invalidReceiverBn;
};

export default function DepositForm({ bitcoinAddress, bitcoinPublicKey, onTransactionSubmitted }: DepositFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Import the wallet store to get the VIA address
  const { viaAddress, addLocalTransaction } = useWalletStore();

  const form = useForm<z.infer<typeof depositFormSchema> & FormContext>({
    resolver: zodResolver(depositFormSchema),
    defaultValues: {
      amount: "",
      recipientViaAddress: "",
      _balance: "0",
    },
  });

  // Update balance in form values when it changes
  useEffect(() => {
    if (balance) {
      form.setValue("_balance" as any, balance);
    }
  }, [balance, form]);

  // Auto-fill the recipient VIA address when available
  useEffect(() => {
    if (viaAddress) {
      form.setValue("recipientViaAddress", viaAddress);
    }
  }, [viaAddress, form]);

  // Fetch Bitcoin balance when address is available
  useEffect(() => {
    async function fetchBalance() {
      if (!bitcoinAddress) return;

      try {
        setIsLoadingBalance(true);
        const balanceInSats = await getBitcoinBalance(bitcoinAddress);
        // Convert from satoshis to BTC
        const balanceInBtc = (balanceInSats / Math.pow(10, L1_BTC_DECIMALS)).toFixed(8);
        setBalance(balanceInBtc);
      } catch (error) {
        console.error("Error fetching balance:", error);
        toast.error("Failed to fetch balance", {
          description: "Could not retrieve your Bitcoin balance. Please try again later.",
        });
      } finally {
        setIsLoadingBalance(false);
      }
    }

    fetchBalance();
  }, [bitcoinAddress]);

  // Function to handle max amount button click
  const handleMaxAmount = () => {
    if (balance) {
      // Set a slightly lower amount to account for transaction fees
      const maxAmount = Math.max(0, parseFloat(balance) - 0.0001).toFixed(8);
      form.setValue("amount", maxAmount);
    }
  };

  async function onSubmit(values: z.infer<typeof depositFormSchema>) {
    try {
      setIsSubmitting(true);

      if (!bitcoinAddress || !bitcoinPublicKey) {
        throw new Error("Bitcoin address or public key not found");
      }

      // Remove '0x' prefix if present
      const recipientAddress = values.recipientViaAddress.startsWith('0x')
        ? values.recipientViaAddress.slice(2)
        : values.recipientViaAddress;

      // Execute the deposit
      const result = await executeDeposit({
        bitcoinAddress,
        bitcoinPublicKey,
        recipientViaAddress: recipientAddress,
        amountInBtc: Number.parseFloat(values.amount),
      });

      setTxHash(result.txId);
      setExplorerUrl(result.explorerUrl);
      setIsSuccess(true);
      toast.success("Deposit Transaction Broadcast", {
        description: "Your deposit transaction has been submitted to the Bitcoin network.",
        duration: 5000,
        className: "text-base font-medium",
      });

      // Add to onSubmit function after setting txHash and explorerUrl
      addLocalTransaction({
        type: 'deposit',
        amount: values.amount,
        status: 'Pending',
        txHash: result.txId,
        l1ExplorerUrl: result.explorerUrl
      });

      onTransactionSubmitted();

    } catch (error) {
      console.error("Deposit error:", error);
      toast.error("Deposit Failed", {
        description: error instanceof Error ? error.message : "There was an error processing your deposit. Please try again.",
        duration: 5000,
        className: "text-base font-medium",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

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
                    Your deposit transaction has been submitted to the Bitcoin network and it is being processed
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

  return (
    <div className="w-full max-w-md min-w-[300px] sm:min-w-[360px] mx-auto">
      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2">
          <Image
            src="/bitcoin-logo.svg"
            alt="Bitcoin"
            width={20}
            height={20}
            className="text-amber-500"
          />
          <div className="flex flex-col">
            <span className="text-sm font-medium">Bitcoin</span>
            <span className="text-xs text-muted-foreground">Network</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1 px-2 py-1 bg-primary/5 rounded-full">
            <Image
              src="/bitcoin-logo.svg"
              alt="BTC"
              width={14}
              height={14}
              className="text-amber-500"
            />
            <span className="text-xs font-medium">BTC</span>
          </div>
          <ArrowRight className="h-5 w-10 text-primary" strokeWidth={2.5} />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">VIA</span>
            <span className="text-xs text-muted-foreground">Network</span>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <div className="flex justify-between items-center">
                  <FormLabel className="text-sm">BTC Amount</FormLabel>
                </div>

                <FormControl>
                  <div className="relative">
                    <Input
                      placeholder="0.001"
                      className={cn(
                        "placeholder:text-muted-foreground/60 pr-16",
                        field.value &&
                        balance &&
                        parseFloat(field.value) > parseFloat(String(balance)) &&
                        "border-red-500 focus-visible:ring-red-500"
                      )}
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={handleMaxAmount}
                      disabled={
                        isLoadingBalance || !balance || parseFloat(String(balance)) <= 0
                      }
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
                      <span
                        className={cn(
                          "font-medium",
                          field.value &&
                          Number(field.value) > Number(balance) &&
                          "text-red-500",
                          field.value &&
                          Number(field.value) > Number(balance) * 0.95 &&
                          "text-amber-500"
                        )}
                      >
                        {balance} BTC
                      </span>
                    )}
                  </div>
                )}

                <FormMessage />

                <FormField
                  control={form.control}
                  name="recipientViaAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Recipient VIA Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="0x..."
                          className="placeholder:text-muted-foreground/60"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormItem>
            )}
          />

          {txHash && (
            <Alert>
              <AlertDescription className="text-sm break-all">Transaction submitted: {txHash}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Button
              type="submit"
              className="w-full"
              disabled={
                isSubmitting ||
                !form.watch("amount") ||
                parseFloat(form.watch("amount") || "0") <= 0 ||
                (!!balance && parseFloat(form.watch("amount") || "0") > parseFloat(balance))
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Deposit"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

