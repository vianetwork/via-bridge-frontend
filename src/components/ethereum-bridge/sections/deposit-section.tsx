// src/components/ethereum-bridge/sections/deposit-section.tsx
"use client";

import AddressFieldWithWallet from "@/components/address-field-with-wallet";
import { Button } from "@/components/ui/button";

interface DepositSectionProps {
  amount: string;
  recipient: string;
  onRecipientChange: (address: string) => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  error?: string | null;
}

export function DepositSection({ amount, recipient, onRecipientChange, onSubmit, isSubmitting, error }: DepositSectionProps) {
  return (
    <div className="space-y-4">
      <AddressFieldWithWallet mode="via" label="Recipient Via address" placeholder="0x..." value={recipient} onChange={onRecipientChange}/>

      <Button onClick={onSubmit} disabled={isSubmitting || !amount || !recipient}>
        Deposit
      </Button>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}