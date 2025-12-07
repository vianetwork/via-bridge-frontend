"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SUPPORTED_ASSETS } from "@/services/ethereum/config";
import { useWalletStore } from "@/store/wallet-store";

interface EthereumWithdrawFormProps {
    asset: typeof SUPPORTED_ASSETS[0];
    isYield: boolean;
}

const withdrawFormSchema = z.object({
    amount: z.string().refine((val) => {
        const n = parseFloat(val);
        return !isNaN(n) && n > 0;
    }, "Amount must be greater than 0"),
    recipientAddress: z.string().min(42, "Invalid Ethereum address").max(42, "Invalid Ethereum address").regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
});

export default function EthereumWithdrawForm({ asset, isYield }: EthereumWithdrawFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addLocalTransaction } = useWalletStore();

    const form = useForm<z.infer<typeof withdrawFormSchema>>({
        resolver: zodResolver(withdrawFormSchema),
        defaultValues: {
            amount: "",
            recipientAddress: "",
        },
    });

    async function onSubmit(values: z.infer<typeof withdrawFormSchema>) {
        try {
            setIsSubmitting(true);
            // TODO: Implement actual withdraw logic here
            // Call withdraw function on bridge contract

            console.log("Withdrawing", values.amount, asset.symbol, "to", values.recipientAddress, "Yield:", isYield);

            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay

            addLocalTransaction({
                type: 'withdraw',
                amount: values.amount,
                status: 'Pending',
                txHash: "0x" + Math.random().toString(16).slice(2), // Mock hash
                l2ExplorerUrl: "https://explorer.via.network", // Mock URL
                symbol: asset.symbol
            });

            toast.success("Withdrawal Submitted", {
                description: `Withdrawing ${values.amount} ${asset.symbol}`,
            });
            form.reset();
        } catch (error) {
            console.error("Withdrawal error:", error);
            toast.error("Withdrawal Failed", {
                description: "Something went wrong. Please try again.",
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Amount ({asset.symbol})</FormLabel>
                            <FormControl>
                                <Input placeholder="0.00" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="recipientAddress"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Recipient Address</FormLabel>
                            <FormControl>
                                <Input placeholder="0x..." {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
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
    );
}
