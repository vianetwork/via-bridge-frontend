// src/components/ethereum-bridge/sections/deposit-section.tsx
"use client";

import AddressFieldWithWallet from "@/components/address-field-with-wallet";

interface DepositSectionProps {
  amount: string;
  recipient: string;
  onRecipientChange: (address: string) => void;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  error?: string | null;
}

export function DepositSection({ amount, recipient, onRecipientChange, onSubmit, isSubmitting, error }: DepositSectionProps) {
  const canSubmit = !isSubmitting && !!amount && !!recipient;

  return (
    <div className="space-y-4">
      <AddressFieldWithWallet mode="via" label="Recipient Via address" placeholder="0x..." value={recipient} onChange={onRecipientChange}/>

      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className={`w-full py-4 rounded-md font-semibold text-base transition-colors ${
          canSubmit
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-slate-300 text-slate-500 cursor-not-allowed"
        }`}
      >
        {isSubmitting ? "Processing..." : "Deposit"}
      </button>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
