"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ArrowRight, Bitcoin, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

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
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2.5 mb-4">
        <div className="flex items-center gap-1.5">
          <div className="h-4 w-4 rounded-full bg-primary" />
          <span className="text-sm">VIA</span>
        </div>
        <div className="flex flex-col items-center text-xs text-muted-foreground">
          <span>BTC</span>
          <ArrowRight className="h-5 w-10 text-primary" strokeWidth={2.5} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm">Bitcoin</span>
          <Bitcoin className="h-4 w-4 text-amber-500" />
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
                <FormDescription>Enter the amount of BTC to withdraw (minimum 0.00001 BTC)</FormDescription>
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
                <FormDescription>Enter the Bitcoin address to receive funds</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {viaAddress && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full bg-primary" />
                  <p className="font-medium">From VIA Address</p>
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
