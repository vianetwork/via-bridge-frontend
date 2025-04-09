"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ArrowRight, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import Image from "next/image";

interface WithdrawFormProps {
  viaAddress: string | null
}

const withdrawFormSchema = z.object({
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
  recipientBitcoinAddress: z.string().min(1, {
    message: "Bitcoin address is required",
  }),
});

export default function WithdrawForm({ viaAddress }: WithdrawFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const form = useForm<z.infer<typeof withdrawFormSchema>>({
    resolver: zodResolver(withdrawFormSchema),
    defaultValues: {
      amount: "",
      recipientBitcoinAddress: "",
    },
  });

  async function onSubmit(values: z.infer<typeof withdrawFormSchema>) {
    try {
      setIsSubmitting(true);

      // Simulate API call for withdrawal
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Mock transaction hash
      const mockTxHash = "0x" + Math.random().toString(16).substring(2, 42);
      setTxHash(mockTxHash);

      toast.success("Withdrawal initiated", {
        description: "Your withdrawal has been initiated successfully.",
      });
    } catch (error) {
      console.error("Withdrawal error:", error);
      toast.error("Withdrawal failed", {
        description: "There was an error processing your withdrawal. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
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
                  <FormDescription>Enter the amount of BTC to withdraw (minimum 0.00001 BTC)</FormDescription>
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
                  <FormDescription>Enter the Bitcoin address to receive funds</FormDescription>
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
            <Alert>
              <AlertDescription className="text-sm break-all">Transaction submitted: {txHash}</AlertDescription>
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
