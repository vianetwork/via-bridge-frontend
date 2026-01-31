// src/components/sections/asset-and-vault-selection.tsx
import { VaultCard } from '@/components/vault-card';
import { AssetSelectionDialog } from '../dialogs/asset-selection-dialog';

export function AssetAndVaultSelection(props: AssetAndVaultSectionProps) {
  return (
    <div className="px-8 mb-4">
      <AssetSelectionDialog selectedSymbol={props.selectedAssetSymbol} onSelect={props.onSelectedAsset}/>

      <VaultCard
        symbol={props.selectedAssetSymbol}
        apy={props.apy ?? '...'}
        tvl={props.tvl ?? '...'}
        exchangeRate={props.exchangeRateDisplay ?? undefined}
        isSelected
        selectionHint="Change"
        yieldEnabled={props.isYieldEnabled}
        onYieldToggle={props.onToggleYield}
      />
    </div>
  );
}
