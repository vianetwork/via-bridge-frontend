// src/components/ethereum-bridge/sections/withdraw-section.tsx
"use client";

import AddressFieldWithWallet from "@/components/address-field-with-wallet";
import { Button } from "@/components/ui/button";

interface WithdrawSectionProps {
  amount: string;
  recipient: string;
  onRecipientChange: (value: string) => void;
  expectedReceive?: string | null;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
}

export function WithdrawSection({ amount, recipient, onRecipientChange, expectedReceive, onSubmit, isSubmitting }: WithdrawSectionProps) {
  return (
    <div className="space-y-4">
      <AddressFieldWithWallet mode="ethereum" label="Recipient Ethereum Address" placeholder="0x..." value={recipient} onChange={onRecipientChange} />

      {expectedReceive && (
        <div className="text-sm text-muted-foreground">
          Expected to receive: {expectedReceive}
        </div>
      )}

      <Button onClick={onSubmit} disabled={isSubmitting || !amount || !recipient}>Withdraw</Button>
    </div>
  );
}