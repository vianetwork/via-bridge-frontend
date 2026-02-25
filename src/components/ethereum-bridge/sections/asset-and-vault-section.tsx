// src/components/ethereum-bridge/sections/asset-and-vault-section.tsx
'use client';

import { useCallback, useRef } from 'react';

import { AssetSelectionDialog } from '@/components/ethereum-bridge/dialogs/asset-selection-dialog';
import { VaultCard } from '@/components/vault-card';
import { SUPPORTED_ASSETS } from '@/services/ethereum/config';

// Renders the Ethereum bridge asset picker + vault card (APY/TVL/exchange rate + yield toggle).
interface AssetAndVaultSectionProps {
  selectedAssetSymbol: string;
  onSelectAsset: (symbol: string) => void;
  isYieldEnabled: boolean;
  onToggleYield: (enabled: boolean) => void;
  apy: string | null;
  tvl: string | null;
  exchangeRateDisplay: string | null;
}

/**
 * Section shown at the top of the Ethereum bridge form.
 * - Opens asset selection dialog
 * - Displays selected asset vault metrics
 * - Toggles between standard and yield-bearing vault mode
 */
export function AssetAndVaultSection({ selectedAssetSymbol, onSelectAsset, isYieldEnabled, onToggleYield, apy, tvl, exchangeRateDisplay }: AssetAndVaultSectionProps) {
  const dialogTriggerRef = useRef<HTMLDivElement>(null);

  const selectedAsset = SUPPORTED_ASSETS.find((a) => a.symbol === selectedAssetSymbol) ?? SUPPORTED_ASSETS[0];
  const exchangeRate = exchangeRateDisplay ?? undefined;

  // Keep a hidden trigger for the dialog and open it from VaultCard click.
  const dialogTrigger = <div ref={dialogTriggerRef} className="hidden" />;

  const handleCardClick = useCallback(() => {
    dialogTriggerRef.current?.click();
  }, []);

  return (
    <div className="px-8 mb-4">
      <AssetSelectionDialog selectedSymbol={selectedAssetSymbol} onSelect={onSelectAsset} trigger={dialogTrigger} />

      <VaultCard
        symbol={selectedAsset.symbol}
        name={selectedAsset.name}
        icon={selectedAsset.icon}
        apy={apy ?? '...'}
        tvl={tvl ?? '...'}
        exchangeRate={exchangeRate}
        isSelected
        selectionHint="Change"
        onClick={handleCardClick}
        yieldEnabled={isYieldEnabled}
        onYieldToggle={onToggleYield}
      />
    </div>
  );
}
