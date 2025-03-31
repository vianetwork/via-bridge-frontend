"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ArrowRight, Bitcoin, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { executeDeposit } from "@/services/bridge/deposit";

interface DepositFormProps {
  bitcoinAddress: string | null
  bitcoinPublicKey: string | null
}

const depositFormSchema = z.object({
  amount: z
    .string()
    .refine((val) => !isNaN(Number.parseFloat(val)), {
      message: "Amount must be a valid number",
    })
    .refine((val) => Number.parseFloat(val) > 0, {
      message: "Amount must be greater than 0",
    })
    .refine((val) => Number.parseFloat(val) >= 0.00001, {
      message: "Minimum amount is 0.00001 BTC (1000 satoshis)",
    }),
  recipientViaAddress: z
    .string()
    .min(1, { message: "VIA address is required" })
    .refine((val) => {
      if (val.startsWith("0x")) {
        return val.length === 42;
      }
      return val.length === 40;
    }, {
      message: "VIA address must be 20 bytes (40 characters) long",
    }),
});

export default function DepositForm({ bitcoinAddress, bitcoinPublicKey }: DepositFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<z.infer<typeof depositFormSchema>>({
    resolver: zodResolver(depositFormSchema),
    defaultValues: {
      amount: "",
      recipientViaAddress: "",
    },
  });

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
                    Your deposit has been submitted to the Bitcoin network and is being processed
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
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2.5 mb-4">
        <div className="flex items-center gap-1.5">
          <Bitcoin className="h-4 w-4 text-amber-500" />
          <span className="text-sm">Bitcoin</span>
        </div>
        <div className="flex flex-col items-center text-xs text-muted-foreground">
          <span>BTC</span>
          <ArrowRight className="h-5 w-10 text-primary" strokeWidth={3} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">VIA</span>
          <div className="h-4 w-4 rounded-full bg-primary" />
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
                <FormDescription>Enter the amount of BTC to deposit (minimum 0.00001 BTC)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="recipientViaAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Recipient VIA Address</FormLabel>
                <FormControl>
                  <Input placeholder="0x..." className="placeholder:text-muted-foreground/60" {...field} />
                </FormControl>
                <FormDescription>Enter the VIA address to receive funds</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {bitcoinAddress && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bitcoin className="h-4 w-4 text-amber-500" />
                  <p className="font-medium">From Bitcoin Address</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-green-500 font-medium">Connected</span>
                </div>
              </div>
              <p className="font-mono text-xs text-muted-foreground break-all pl-6">{bitcoinAddress}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Deposit"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
