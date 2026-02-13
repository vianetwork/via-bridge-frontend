// src/components/ethereum-bridge/ethereum-bridge-form.tsx
"use client";

import { useMemo, useState } from "react";
import {
  BridgeModeTabs,
  NetworkLaneSelector,
  TransferAmountInput,
  AvailableBalanceDisplay,
  AmountSlider,
} from "@/components/bridge";
import { TransactionHistory } from "@/components/transaction-history";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";

import { AssetAndVaultSection } from "@/components/ethereum-bridge/sections/asset-and-vault-section";
import { DepositSection } from "@/components/ethereum-bridge/sections/deposit-section";
import { WithdrawSection } from "@/components/ethereum-bridge/sections/withdraw-section";
import { ClaimSection } from "@/components/ethereum-bridge/sections/claim-section";
import { useEthereumBridgeForm } from "@/hooks/use-ethereum-bridge-form";
import { useWalletStore } from "@/store/wallet-store";
import { calculateVaultConversion, formatVaultRate } from "@/utils/vault-conversion";

export function EthereumBridgeForm() {
  const form = useEthereumBridgeForm();
  const { ethTransactions, isLoadingTransactions, fetchEthTransactions } = useWalletStore();
  const [showTransactions, setShowTransactions] = useState(false);

  const exchangeRateDisplay = useMemo(() => {
    if (!form.isYieldEnabled || !form.vaultMetrics.exchangeRate) return null;
    return formatVaultRate(
      form.vaultMetrics.exchangeRate,
      form.selectedAsset.symbol,
      form.selectedAsset.l2ValueSymbol || `v${form.selectedAsset.symbol}`,
      form.mode
    );
  }, [form.isYieldEnabled, form.vaultMetrics.exchangeRate, form.selectedAsset, form.mode,
  ]);

  let apyDisplay = form.aaveApys[form.selectedAsset.symbol] || "...";
  if (!form.isYieldEnabled) apyDisplay = "0%";
  if (form.isYieldEnabled && (form.isLoadingApy || form.isLoadingVaultMetrics)) apyDisplay = "...";

  let tvlDisplay = form.vaultMetrics.tvl || form.selectedAsset.tvl;
  if (form.isLoadingVaultMetrics) tvlDisplay = "...";

  const expectedReceiveDisplay = useMemo(() => {
    if (
      form.mode !== "withdraw" ||
      !form.isYieldEnabled ||
      !form.inputAmount ||
      !form.vaultMetrics.exchangeRate
    ) {
      return null;
    }

    const expected = calculateVaultConversion(form.inputAmount,
      form.vaultMetrics.exchangeRate,
      "withdraw",
      form.selectedAsset.decimals
    );

    if (!expected) return null;

    return `${expected.outputAmount} ${form.selectedAsset.symbol}`;
  }, [form.mode, form.isYieldEnabled, form.inputAmount, form.vaultMetrics.exchangeRate, form.selectedAsset,]);

  return (
    <div className="w-full max-w-4xl">
      <BridgeModeTabs
        mode={form.mode}
        onModeChange={form.setMode}
        withdrawBadgeCount={form.readyWithdrawalsCount}
        onWithdrawBadgeClick={() => form.setClaimModalOpen(true)}
      />

      <div className="bg-white border rounded-2xl">
        <div className="px-8 pt-8 text-center">
          <h1 className="text-2xl font-bold">Via Ethereum Network Bridge</h1>
          <p className="text-sm text-slate-600">Bridge assets securely</p>
        </div>

        <AssetAndVaultSection
          selectedAssetSymbol={form.selectedAssetSymbol}
          onSelectAsset={form.setSelectedAssetSymbol}
          isYieldEnabled={form.isYieldEnabled}
          onToggleYield={form.setIsYieldEnabled}
          apy={apyDisplay}
          tvl={tvlDisplay}
          exchangeRateDisplay={exchangeRateDisplay}
        />

        <ClaimSection
          isOpen={form.isClaimModalOpen}
          onOpenChange={form.setClaimModalOpen}
          onReadyCountChange={form.setReadyWithdrawalsCount}
        />

        <div className="px-8 pb-8">
          <NetworkLaneSelector route={form.route} onSwap={form.toggleMode} />

          <TransferAmountInput
            value={form.amount}
            onChange={form.handleAmountChange}
            onMax={form.handleMax}
            unit={form.amountUnit}
            maxDisabled={!form.balance || form.walletBalance <= 0}
          />

          <AvailableBalanceDisplay
            balance={form.balance}
            unit={form.amountUnit}
            isLoading={form.isLoadingBalance}
          />

          <AmountSlider
            value={form.inputAmount}
            max={form.maxAmount}
            onChange={form.handleSliderChange}
            unit={form.amountUnit}
            decimals={form.selectedAsset.decimals}
          />

          {form.mode === "deposit" ? (
            <DepositSection
              amount={form.amount}
              recipient={form.recipientAddress}
              onRecipientChange={form.setRecipientAddress}
              onSubmit={form.submitDeposit}
              isSubmitting={form.isSubmitting}
              error={form.submitError}
            />
          ) : (
            <WithdrawSection
              amount={form.amount}
              recipient={form.recipientAddress}
              onRecipientChange={form.setRecipientAddress}
              expectedReceive={expectedReceiveDisplay}
              onSubmit={form.submitWithdraw}
              isSubmitting={form.isSubmitting}
            />
          )}

          <div className="mt-8">
            <Button
              variant="ghost"
              className="flex items-center justify-between w-full py-2 text-sm font-medium"
              onClick={() => setShowTransactions(!showTransactions)}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Transaction History</span>
                {ethTransactions.length > 0 && (
                  <span className="bg-primary/10 text-primary text-xs rounded-full px-2 py-0.5">
                    {ethTransactions.length}
                  </span>
                )}
              </div>
              {showTransactions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            {showTransactions && (
              <div className="w-full mt-2">
                <TransactionHistory
                  isLoading={isLoadingTransactions}
                  onRefresh={fetchEthTransactions}
                  transactions={ethTransactions}
                  excludeSymbol="BTC"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}