"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ArrowRight, Bitcoin, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"

interface DepositFormProps {
  bitcoinAddress: string | null
}

const depositFormSchema = z.object({
  amount: z
    .string()
    .refine((val) => !isNaN(Number.parseFloat(val)), {
      message: "Amount must be a valid number",
    })
    .refine((val) => Number.parseFloat(val) > 0, {
      message: "Amount must be greater than 0",
    }),
  recipientViaAddress: z.string().min(1, {
    message: "VIA address is required",
  }),
})

export default function DepositForm({ bitcoinAddress }: DepositFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)

  const form = useForm<z.infer<typeof depositFormSchema>>({
    resolver: zodResolver(depositFormSchema),
    defaultValues: {
      amount: "",
      recipientViaAddress: "",
    },
  })

  async function onSubmit(values: z.infer<typeof depositFormSchema>) {
    try {
      setIsSubmitting(true)

      // Simulate API call for deposit
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Mock transaction hash
      const mockTxHash = "0x" + Math.random().toString(16).substring(2, 42)
      setTxHash(mockTxHash)

      toast.success("Deposit initiated", {
        description: "Your deposit has been initiated successfully.",
      })
    } catch (error) {
      console.error("Deposit error:", error)
      toast.error("Deposit failed", {
        description: "There was an error processing your deposit. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-muted p-3 rounded-lg mb-4">
        <div className="flex items-center gap-2">
          <Bitcoin className="h-5 w-5 text-amber-500" />
          <span className="font-medium">Bitcoin</span>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-primary" />
          <span className="font-medium">VIA</span>
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
                  <Input placeholder="0.001" {...field} />
                </FormControl>
                <FormDescription>Enter the amount of BTC to deposit</FormDescription>
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
                  <Input placeholder="0x..." {...field} />
                </FormControl>
                <FormDescription>Enter the VIA address to receive funds</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {bitcoinAddress && (
            <div className="text-sm text-muted-foreground mb-4">
              <p>From Bitcoin address:</p>
              <p className="font-mono text-xs break-all">{bitcoinAddress}</p>
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
              "Deposit"
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}
