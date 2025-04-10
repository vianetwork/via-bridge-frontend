"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ArrowRight, Loader2, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import Image from "next/image";
import { executeWithdraw } from "@/services/bridge/withdraw";

interface WithdrawFormProps {
  viaAddress: string | null
}

const withdrawFormSchema = z.object({
  amount: z
    .string()
    .refine((val) => !isNaN(Number.parseFloat(val)), {
      message: "Amount must be a valid number",
    })
    .refine((val) => Number.parseFloat(val) >= 0.00001, {
      message: "Minimum amount is 0.00001 BTC (1000 satoshis)",
    }),
  recipientBitcoinAddress: z
    .string()
    .min(1, { message: "Bitcoin address is required" })
    .refine((val) => {
      if (val.startsWith("bc1") || val.startsWith("tb1")) {
        return val.length >= 42 && val.length <= 62;
      }
      // TODO: Add support for Bitcoin address formats other than bech32 (SegWit)
      return false;
    }, {
      message: "Invalid Bitcoin address format",
    }),
});

export default function WithdrawForm({ viaAddress }: WithdrawFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<z.infer<typeof withdrawFormSchema>>({
    resolver: zodResolver(withdrawFormSchema),
    defaultValues: {
      amount: "",
      recipientBitcoinAddress: "",
    },
  });

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
      setIsSuccess(true);
      toast.success("Withdrawal Transaction Broadcast", {
        description: "Your withdrawal transaction has been submitted to the VIA network.",
        duration: 5000,
        className: "text-base font-medium",
      });
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
                    Your withdrawal transaction has been submitted to the VIA network and it is being processed
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
    <div className="space-y-6">
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
                <FormLabel>Amount (BTC)</FormLabel>
                <FormControl>
                  <Input placeholder="0.001" className="placeholder:text-muted-foreground/60" {...field} />
                </FormControl>
                {!form.formState.errors.amount && (
                  <FormDescription>Amount of BTC to withdraw (minimum 0.00001 BTC)</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="recipientBitcoinAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Recipient Bitcoin Address</FormLabel>
                <FormControl>
                  <Input placeholder="bc1..." className="placeholder:text-muted-foreground/60" {...field} />
                </FormControl>
                {!form.formState.errors.recipientBitcoinAddress && (
                  <FormDescription>Bitcoin address to receive funds</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {viaAddress && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 border border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full bg-primary" />
                  <p className="text-sm font-medium">Connected VIA Address</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-green-500 font-medium">Connected</span>
                </div>
              </div>
              <p className="font-mono text-xs text-muted-foreground break-all pl-6">{viaAddress}</p>
            </div>
          )}

          {txHash && (
            <Alert className="bg-primary/5 border-primary/10">
              <AlertDescription className="text-sm break-all text-primary/80">Transaction submitted: {txHash}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
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
