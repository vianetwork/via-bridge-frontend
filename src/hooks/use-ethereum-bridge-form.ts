// src/hooks/use-ethereum-bridge-form.ts
"use client";

import { useCallback, useMemo, useState } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { toast } from "sonner";
import { getWalletClient } from "@wagmi/core";

import { wagmiConfig } from "@/lib/wagmi/config";
import { getAddChainParams } from "@/lib/wagmi/chains";
import { clientToSigner } from "@/hooks/use-ethers-signer";
import { SUPPORTED_ASSETS } from "@/services/ethereum/config";
import { useWalletState } from "@/hooks/use-wallet-state";
import { GetCurrentRoute } from "@/services/bridge/routes";
import { useAaveData } from "@/hooks/use-aave-data";
import { useVaultMetrics } from "@/hooks/use-vault-metrics";
import { useEthereumBalance } from "@/hooks/use-ethereum-balance";
import { executeEthereumDeposit } from "@/services/ethereum/deposit";
import { executeEthereumWithdraw } from "@/services/ethereum/withdraw";
import { parseTokenAmount } from "@/utils/token-amount";

import type { BridgeMode } from "@/components/bridge/bridge-mode-tabs";
import type { SupportedAsset } from "@/services/ethereum/config";

export interface UseEthereumBridgeFormResult {
  mode: BridgeMode;
  setMode: (mode: BridgeMode) => void;
  toggleMode: () => void;

  selectedAssetSymbol: string;
  setSelectedAssetSymbol: (symbol: string) => void;
  selectedAsset: SupportedAsset;

  isYieldEnabled: boolean;
  setIsYieldEnabled: (enabled: boolean) => void;

  amount: string;
  setAmount: (value: string) => void;
  inputAmount: number;
  maxAmount: number;
  amountUnit: string;
  parsedAmount: ReturnType<typeof parseTokenAmount>;
  isAmountValid: boolean;
  amountError: string | null;
  handleAmountChange: (value: string) => void;
  handleMax: () => void;
  handleSliderChange: (value: number) => void;

  route: ReturnType<typeof GetCurrentRoute>;
  isSwitchingNetwork: boolean;
  ensureOnSourceNetwork: () => Promise<void>;

  balance: string | null;
  walletBalance: number;
  isLoadingBalance: boolean;
  refetchBalance: () => void;

  aaveApys: Record<string, string>;
  isLoadingApy: boolean;
  vaultMetrics: ReturnType<typeof useVaultMetrics>["metrics"];
  isLoadingVaultMetrics: boolean;

  submitDeposit: () => Promise<void>;
  submitWithdraw: () => Promise<void>;
  isSubmitting: boolean;
  submitError: string | null;

  recipientAddress: string;
  setRecipientAddress: (value: string) => void;

  isClaimModalOpen: boolean;
  setClaimModalOpen: (open: boolean) => void;
  readyWithdrawalsCount: number;
  setReadyWithdrawalsCount: (count: number) => void;
}

export function useEthereumBridgeForm(): UseEthereumBridgeFormResult {
  const [mode, setMode] = useState<BridgeMode>("deposit");

  const defaultAsset = SUPPORTED_ASSETS.find((a) => a.active) || SUPPORTED_ASSETS[0];
  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState(defaultAsset.symbol);
  const [isYieldEnabled, setIsYieldEnabled] = useState(true);
  const [amount, setAmount] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [isClaimModalOpen, setClaimModalOpen] = useState(false);
  const [readyWithdrawalsCount, setReadyWithdrawalsCount] = useState(0);

  const { isMetamaskConnected, isCorrectL1Network, isCorrectViaNetwork, l1Address, viaAddress } = useWalletState();

  const route = useMemo(() => GetCurrentRoute(mode, "ethereum"), [mode]);
  const targetChainId = route.fromNetwork.chainId!;

  const selectedAsset = useMemo(() => SUPPORTED_ASSETS.find((a) => a.symbol === selectedAssetSymbol) || defaultAsset, [defaultAsset, selectedAssetSymbol]);

  const currentChainId = useChainId();
  const { switchChainAsync, isPending } = useSwitchChain();

  const addEthereumChainParameter = useMemo(() => getAddChainParams(targetChainId), [targetChainId]);

  const ensureOnSourceNetwork = useCallback(async () => {
    if (!targetChainId) throw new Error("Route is missing fromNetwork.chainId");
    // No-op if already on the correct chain/network
    if (currentChainId === targetChainId) return;

    const args = addEthereumChainParameter
      ? { chainId: targetChainId, addEthereumChainParameter }
      : { chainId: targetChainId };
    await switchChainAsync(args);
  }, [targetChainId, currentChainId, addEthereumChainParameter, switchChainAsync]);

  const { apys: aaveApys, isLoading: isLoadingApy } = useAaveData();
  const { metrics: vaultMetrics, isLoading: isLoadingVaultMetrics } = useVaultMetrics({ assetSymbol: selectedAssetSymbol, isYieldEnabled});

  const inputAmount = parseFloat(amount) || 0;
  const balanceWalletAddress = mode === "deposit" ? (l1Address || viaAddress) : viaAddress;
  const isCorrectNetworkForBalance = mode === "deposit" ? isCorrectL1Network : isCorrectViaNetwork;

  const balanceTokenAddress = mode === "deposit"
    ? selectedAsset.addresses.sepolia
    : isYieldEnabled
      ? selectedAsset.vaultAddresses.via.yieldBearing
      : selectedAsset.vaultAddresses.via.standard;

  const { balance, isLoading: isLoadingBalance, refetch: refetchBalance } = useEthereumBalance({
    tokenAddress: balanceTokenAddress,
    walletAddress: balanceWalletAddress,
    decimals: selectedAsset.decimals,
    isOnCorrectNetwork: isCorrectNetworkForBalance,
    isConnected: isMetamaskConnected,
  });

  const walletBalance = balance ? parseFloat(balance) : 0;
  const maxAmount = walletBalance || 0;

  const amountUnit = (isYieldEnabled && mode === "withdraw")
    ? (selectedAsset.l2ValueSymbol || `v${selectedAsset.symbol}`)
    : selectedAsset.symbol;

  const parsedAmount = useMemo(() => parseTokenAmount(amount, selectedAsset.decimals), [amount, selectedAsset.decimals]);

  const amountError = parsedAmount.error || null;
  const isAmountValid = parsedAmount.baseUnits !== undefined && !parsedAmount.error;

  const handleAmountChange = (value: string) => {
    // Be permissive while typing: keep only digits and a single decimal point, then truncate any extra decimals.
    const sanitized = value.replace(/[^0-9.]/g, "");

    const firstDotIndex = sanitized.indexOf(".");
    const cleaned =
      firstDotIndex === -1
        ? sanitized
        : sanitized.slice(0, firstDotIndex + 1) + sanitized.slice(firstDotIndex + 1).replace(/\./g, "");

    if (!cleaned.includes(".")) {
      setAmount(cleaned);
      return;
    }

    const [intPart, decPart] = cleaned.split(".");
    if (decPart && decPart.length > selectedAsset.decimals) {
      setAmount(`${intPart}.${decPart.slice(0, selectedAsset.decimals)}`);
      return;
    }

    setAmount(cleaned);
  };

  const handleMax = () => {
    if (!balance) return;
    const max = Math.min(maxAmount, parseFloat(balance));
    setAmount(max.toFixed(selectedAsset.decimals));
  };

  // AmountSlider emits the raw token amount (0..max), not a percentage.
  const handleSliderChange = (value: number) => {
    setAmount(value.toFixed(selectedAsset.decimals));
  };

  const submitDeposit = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    // TODO refactor Duplicated code fragment (12 lines long)
    try {
      if (!isAmountValid) {
        const message = amountError || "Invalid amount";
        setSubmitError(message);
        toast.error("Invalid amount", { description: message });
        return;
      }

      await ensureOnSourceNetwork();

      const walletClient = await getWalletClient(wagmiConfig, { chainId: targetChainId });
      if (!walletClient) throw new Error("Wallet not ready");
      const signer = clientToSigner(walletClient);

      await executeEthereumDeposit({
        asset: selectedAsset,
        amount,
        recipientViaAddress: recipientAddress,
        isYield: isYieldEnabled,
        signer,
      });

      setAmount("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Deposit failed";
      setSubmitError(message);
      toast.error("Deposit failed", { description: message });
      throw error;
    } finally {
       setIsSubmitting(false);
    }
  }, [ensureOnSourceNetwork, targetChainId, selectedAsset, amount, recipientAddress, isYieldEnabled, isAmountValid, amountError]);

  const submitWithdraw = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (!isAmountValid) {
        const message = amountError || "Invalid amount";
        setSubmitError(message);
        toast.error("Invalid amount", { description: message });
        return;
      }

      await ensureOnSourceNetwork();

      const walletClient = await getWalletClient(wagmiConfig, { chainId: targetChainId});
      if (!walletClient) throw new Error("Wallet not ready");
      const signer = clientToSigner(walletClient);

      await executeEthereumWithdraw({
        asset: selectedAsset,
        amount,
        recipientEthereumAddress: recipientAddress,
        isYield: isYieldEnabled,
        signer,
      });

      setAmount("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Withdraw failed";
      setSubmitError(message);
      toast.error("Withdraw failed", { description: message });
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  }, [ensureOnSourceNetwork, targetChainId, selectedAsset, amount, recipientAddress, isYieldEnabled, isAmountValid, amountError]);

  const toggleMode = () => {
    setMode(mode === "deposit" ? "withdraw" : "deposit");
    setAmount("");
  };

  return {
    mode,
    setMode,
    toggleMode,
    selectedAssetSymbol,
    setSelectedAssetSymbol,
    selectedAsset,
    isYieldEnabled,
    setIsYieldEnabled,
    amount,
    setAmount,
    inputAmount,
    maxAmount,
    amountUnit,
    parsedAmount,
    isAmountValid,
    amountError,
    handleAmountChange,
    handleMax,
    handleSliderChange,
    route,
    isSwitchingNetwork: isPending,
    ensureOnSourceNetwork,
    balance,
    walletBalance,
    isLoadingBalance,
    refetchBalance,
    aaveApys,
    isLoadingApy,
    vaultMetrics,
    isLoadingVaultMetrics,
    submitDeposit,
    submitWithdraw,
    isSubmitting,
    submitError,
    recipientAddress,
    setRecipientAddress,
    isClaimModalOpen,
    setClaimModalOpen,
    readyWithdrawalsCount,
    setReadyWithdrawalsCount,
  };
}
