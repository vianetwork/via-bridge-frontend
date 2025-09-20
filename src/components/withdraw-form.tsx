"use client";

import { useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ArrowRight, Loader2, ExternalLink, HelpCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import Image from "next/image";
import { executeWithdraw } from "@/services/bridge/withdraw";
import { useWalletStore } from "@/store/wallet-store";
import { getViaBalance } from "@/services/via/balance";
import { cn } from "@/lib/utils";
import { toL1Amount } from "@/helpers";
import { FormAmountSlider } from "@/components/form-amount-slider";
import { MIN_WITHDRAW_BTC, MIN_WITHDRAW_SATS } from "@/services/constants";
import { useDebounce } from "@/hooks/useDebounce";

interface WithdrawFormProps {
  viaAddress: string | null
  onTransactionSubmitted: () => void;
}

const withdrawFormSchema = z.object({
  amount: z
    .string()
    .refine((val) => Number.parseFloat(val) >= MIN_WITHDRAW_BTC, {
      message: `Minimum amount is ${MIN_WITHDRAW_BTC} BTC (${MIN_WITHDRAW_SATS.toLocaleString()} satoshis)`,
    }),
  recipientBitcoinAddress: z
    .string()
    .min(1, { message: "Bitcoin address is required" })
    .refine((val) => {
      if (val.startsWith("bc1") || val.startsWith("tb1") || val.startsWith("bcr")) {
        return val.length >= 42 && val.length <= 62;
      }
      // TODO: Add support for Bitcoin address formats other than bech32 (SegWit)
      return false;
    }, {
      message: "Invalid Bitcoin address format",
    }),
});

export default function WithdrawForm({ viaAddress, onTransactionSubmitted }: WithdrawFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [amount, setAmount] = useState("0");

  // Import the wallet store to get the Bitcoin address
  const { bitcoinAddress, addLocalTransaction, isLoadingFeeEstimation, feeEstimation, fetchFeeEstimation } = useWalletStore();

  const form = useForm<z.infer<typeof withdrawFormSchema>>({
    resolver: zodResolver(withdrawFormSchema),
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      amount: "",
      recipientBitcoinAddress: "",
    },
  });

  // Auto-fill the recipient Bitcoin address when available
  useEffect(() => {
    if (bitcoinAddress) {
      form.setValue("recipientBitcoinAddress", bitcoinAddress);
    }
  }, [bitcoinAddress, form]);

  // Fetch VIA balance when address is available
  useEffect(() => {
    async function fetchBalance() {
      if (!viaAddress) return;

      try {
        setIsLoadingBalance(true);
        const balanceInBtc = await getViaBalance(viaAddress);
        setBalance(balanceInBtc);
      } catch (error) {
        console.error("Error fetching balance:", error);
        toast.error("Failed to fetch balance", {
          description: "Could not retrieve your VIA balance. Please try again later.",
        });
      } finally {
        setIsLoadingBalance(false);
      }
    }

    fetchBalance();
  }, [viaAddress]);

    const liveAmount = form.watch("amount");
    const debouncedAmount = useDebounce(liveAmount, 600); // 600ms debounce delay
    const lastSatsRef = useRef<number | null>(null);
    useEffect(() => {
        setAmount(String(liveAmount ?? ""));
        }, [liveAmount]);
    useEffect(() => {
        try {
            const str = String(debouncedAmount ?? "");
            const sats = toL1Amount(str); // "0.00123456" -> 123456
            if (!Number.isFinite(sats)) return;
            if (sats  <= 0 ) return;
            if (sats <  MIN_WITHDRAW_SATS) return;  // 0.00002 BTC minimum
            if (lastSatsRef.current == sats) return;
            lastSatsRef.current = sats;
            fetchFeeEstimation(sats);
        } catch (err) {
            console.error("Error fetching fee estimation:", err);
        }
    }, [debouncedAmount, fetchFeeEstimation]);

  async function onSubmit(values: z.infer<typeof withdrawFormSchema>) {
    if (!viaAddress) {
      toast.error("VIA address is required", {
        description: "Please connect your VIA wallet to proceed with the withdrawal.",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await executeWithdraw({
        amount: values.amount,
        recipientBitcoinAddress: values.recipientBitcoinAddress,
      });
      setTxHash(result.txHash);
      setExplorerUrl(result.explorerUrl);
      addLocalTransaction({
        type: 'withdraw',
        amount: values.amount,
        status: 'Pending',
        txHash: result.txHash,
        l2ExplorerUrl: result.explorerUrl
      });
      setIsSuccess(true);
      toast.success("Withdrawal Transaction Broadcast", {
        description: "Your withdrawal transaction has been submitted to the VIA network.",
        duration: 5000,
        className: "text-base font-medium",
      });

      onTransactionSubmitted();
    } catch (error) {
      console.error("Withdrawal error:", error);
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
                  <h3 className="text-2xl font-semibold tracking-tight">Withdrawal Transaction Submitted</h3>
                  <p className="text-muted-foreground text-sm">
                    Your withdrawal transaction has been submitted to the VIA network and it is being processed.
                    Receiving BTC on the Bitcoin network can take up to 24 hours, please be patient.
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
                    // setAmount(0);
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

  return (
    <div className="w-full max-w-md min-w-[300px] sm:min-w-[360px] mx-auto">
      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
            <div className="h-3 w-3 rounded-full bg-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">VIA</span>
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
                      step="any"
                      type="number"
                      inputMode="decimal"
                      className={cn(
                        "placeholder:text-muted-foreground/60 pr-16", // space inside input for the button
                        field.value &&
                        balance &&
                        parseFloat(field.value) > parseFloat(String(balance)) &&
                        "border-red-500 focus-visible:ring-red-500"
                      )}
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (balance) {
                            form.setValue("amount", String(balance));
                        }
                      }}
                      disabled={
                        isLoadingBalance || !balance || parseFloat(String(balance)) <= 0
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-100 text-blue-600 hover:bg-blue-200 disabled:opacity-50 mr-2"
                    >
                      MAX
                    </button>
                  </div>
                </FormControl>
                <FormMessage />

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
                        {(Number(balance)).toFixed(4)} BTC
                      </span>
                    )}
                  </div>
                )}

                {/* balance usage progress */}
                {balance && Number(balance) >0 && (
                  <FormAmountSlider
                    form={form}
                    name="amount"
                    balance={Number.parseFloat(String(balance))}
                    min={MIN_WITHDRAW_BTC}
                    feeReserve={0}
                    isLoading={isLoadingBalance}
                    pulseWhenEmpty={!(field.value && String(field.value).trim())}
                    unit="BTC"
                    progressClassName="bg-green-500"
                    sliderAccentClassName="accent-green-500"
                    ariaLabel="Withdraw amount"
                    decimals={8}
                    />
                )}

                <FormField
                  control={form.control}
                  name="recipientBitcoinAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">Recipient Bitcoin Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="bc1..."
                          className="placeholder:text-muted-foreground/60"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {field.value && (
                  <div className="text-xs text-muted-foreground mt-4 min-h-[1rem]">
                    {isLoadingFeeEstimation ? (
                      <div className="w-48 h-4 rounded bg-muted animate-pulse" />
                    ) : feeEstimation !== null && (
                      <div className="border border-muted rounded-md bg-muted/40 px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            Estimated network fee:{" "}
                            <span className="font-medium text-foreground">
                              {feeEstimation.fee.toLocaleString()} sats
                            </span>
                          </div>
                          {/* Custom Tooltip */}
                          <div className="relative group">
                            <HelpCircle className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 transform sm:left-auto sm:right-0 sm:translate-x-0 mb-2 px-2 py-1.5 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50 w-64 shadow-lg border border-gray-700 pointer-events-none">
                              <div className="text-left leading-snug">
                                This is the estimated fee required to process your withdrawal through the verifier network. Any unused amount will be refunded to your wallet.
                              </div>
                            </div>
                          </div>
                        </div>

                        {(() => {
                          const btcAmount = Math.max(0, toL1Amount(amount.toString()) - feeEstimation.fee);

                          const getColorClass = (amount: number) => {
                            if (amount < 250) return "text-red-500";
                            if (amount < 1000) return "text-orange-500";
                            return "text-green-500";
                          };

                          const colorClass = getColorClass(btcAmount);

                          return (
                            <div className={`text-xs ${colorClass}`}>
                              Minimum BTC you will receive:{" "}
                              <span className={`font-medium ${colorClass}`}>
                                {btcAmount.toLocaleString()} sats
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </FormItem>
            )}
          />
          {txHash && (
            <Alert className="bg-primary/5 border-primary/10">
              <AlertDescription className="text-sm break-all text-primary/80">
                Transaction submitted: {txHash}
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={
              isSubmitting ||
              !feeEstimation ||
              toL1Amount(amount.toString()) - feeEstimation.fee < 0 ||
              isLoadingFeeEstimation ||
              !form.watch("amount") ||
              parseFloat(form.watch("amount") || "0") <= 0 ||
              (!!balance &&
                parseFloat(form.watch("amount") || "0") > parseFloat(String(balance)))
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Withdraw"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
