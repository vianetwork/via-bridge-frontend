// src/components/ethereum-bridge/dialogs/asset-selection-dialog.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SUPPORTED_ASSETS } from "@/services/ethereum/config";

interface AssetSelectionDialogProps {
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
  trigger?: React.ReactNode;
}

/**
 * Dialog for selecting the bridge asset (for example USDC) from supported vault assets.
 */
export function AssetSelectionDialog({ selectedSymbol, onSelect, trigger }: AssetSelectionDialogProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (symbol: string) => {
    onSelect(symbol);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Select Token Vault</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {SUPPORTED_ASSETS.map((asset) => {
            const isActive = asset.active;
            return (
              <div
                key={asset.symbol}
                className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                  isActive ? "cursor-pointer hover:bg-slate-50" : "opacity-50 cursor-not-allowed bg-slate-100"
                } ${selectedSymbol === asset.symbol ? "border-primary bg-primary/5" : "border-border"}`}
                onClick={() => {
                  if (isActive) handleSelect(asset.symbol);
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="relative h-8 w-8 rounded-full overflow-hidden">
                    <Image src={asset.icon} alt={asset.symbol} fill className="object-cover" />
                  </div>
                  <div>
                    <p className="font-medium">{asset.name}</p>
                    <p className="text-sm text-muted-foreground">{asset.symbol}</p>
                  </div>
                </div>
                {!isActive && <span className="text-xs text-muted-foreground">(Coming Soon)</span>}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}


