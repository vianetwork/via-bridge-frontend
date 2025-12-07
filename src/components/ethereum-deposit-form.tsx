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

interface EthereumDepositFormProps {
    asset: typeof SUPPORTED_ASSETS[0];
    isYield: boolean;
}

const depositFormSchema = z.object({
    amount: z.string().refine((val) => {
        const n = parseFloat(val);
        return !isNaN(n) && n > 0;
    }, "Amount must be greater than 0"),
});

export default function EthereumDepositForm({ asset, isYield }: EthereumDepositFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { addLocalTransaction } = useWalletStore();

    const form = useForm<z.infer<typeof depositFormSchema>>({
        resolver: zodResolver(depositFormSchema),
        defaultValues: {
            amount: "",
        },
    });

    async function onSubmit(values: z.infer<typeof depositFormSchema>) {
        try {
            setIsSubmitting(true);
            // TODO: Implement actual deposit logic here
            // 1. Check allowance
            // 2. Approve if needed
            // 3. Call deposit function on bridge contract

            console.log("Depositing", values.amount, asset.symbol, "Yield:", isYield);

            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate delay

            addLocalTransaction({
                type: 'deposit',
                amount: values.amount,
                status: 'Pending',
                txHash: "0x" + Math.random().toString(16).slice(2), // Mock hash
                l1ExplorerUrl: "https://etherscan.io", // Mock URL
                symbol: asset.symbol
            });

            toast.success("Deposit Submitted", {
                description: `Deposited ${values.amount} ${asset.symbol}`,
            });
            form.reset();
        } catch (error) {
            console.error("Deposit error:", error);
            toast.error("Deposit Failed", {
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
    );
}
