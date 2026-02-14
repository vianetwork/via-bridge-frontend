// src/components/ethereum-bridge/sections/withdraw-section.tsx
"use client";

import AddressFieldWithWallet from "@/components/address-field-with-wallet";

interface WithdrawSectionProps {
  amount: string;
  recipient: string;
  onRecipientChange: (value: string) => void;
  expectedReceive?: string | null;
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
}

export function WithdrawSection({ amount, recipient, onRecipientChange, expectedReceive, onSubmit, isSubmitting }: WithdrawSectionProps) {
  const canSubmit = !isSubmitting && !!amount && !!recipient;

  return (
    <div className="space-y-4">
      <AddressFieldWithWallet mode="ethereum" label="Recipient Ethereum Address" placeholder="0x..." value={recipient} onChange={onRecipientChange} />

      {expectedReceive && (
        <div className="text-sm text-muted-foreground">
          Expected to receive: {expectedReceive}
        </div>
      )}

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
        {isSubmitting ? "Processing..." : "Withdraw"}
      </button>
    </div>
  );
}
