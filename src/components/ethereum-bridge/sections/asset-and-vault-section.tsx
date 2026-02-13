// src/components/ethereum-bridge/sections/asset-and-vault-section.tsx
"use client";

import { useMemo, useRef } from "react";
import { VaultCard } from "@/components/vault-card";
import { AssetSelectionDialog } from "@/components/ethereum-bridge/dialogs/asset-selection-dialog";
import { SUPPORTED_ASSETS } from "@/services/ethereum/config";

interface AssetAndVaultSectionProps {
  selectedAssetSymbol: string;
  onSelectAsset: (symbol: string) => void;
  isYieldEnabled: boolean;
  onToggleYield: (enabled: boolean) => void;
  apy: string | null;
  tvl: string | null;
  exchangeRateDisplay: string | null;
}

export function AssetAndVaultSection({
  selectedAssetSymbol,
  onSelectAsset,
  isYieldEnabled,
  onToggleYield,
  apy,
  tvl,
  exchangeRateDisplay,
}: AssetAndVaultSectionProps) {
  const dialogTriggerRef = useRef<HTMLDivElement>(null);

  const selectedAsset = useMemo(
    () => SUPPORTED_ASSETS.find((a) => a.symbol === selectedAssetSymbol) || SUPPORTED_ASSETS[0],
    [selectedAssetSymbol]
  );

  const handleCardClick = () => {
    // Programmatically trigger the dialog by clicking the hidden trigger
    dialogTriggerRef.current?.click();
  };

  return (
    <div className="px-8 mb-4">
      <AssetSelectionDialog
        selectedSymbol={selectedAssetSymbol}
        onSelect={onSelectAsset}
        trigger={<div ref={dialogTriggerRef} className="hidden" />}
      />

      <VaultCard
        symbol={selectedAsset.symbol}
        name={selectedAsset.name}
        icon={selectedAsset.icon}
        apy={apy ?? "..."}
        tvl={tvl ?? "..."}
        exchangeRate={exchangeRateDisplay ?? undefined}
        isSelected
        selectionHint="Change"
        onClick={handleCardClick}
        yieldEnabled={isYieldEnabled}
        onYieldToggle={onToggleYield}
      />
    </div>
  );
}
