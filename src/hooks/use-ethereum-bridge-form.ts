// src/hooks/use-ethereum-bridge-form.ts
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { toast } from "sonner";
import { getWalletClient } from "@wagmi/core";

import { wagmiConfig } from "@/lib/wagmi/config";
import { getAddChainParams } from "@/lib/wagmi/chains";
import { clientToSigner } from "@/hooks/use-ethers-signer";
import { SUPPORTED_ASSETS } from "@/services/ethereum/config";
import { useWalletState } from "@/hooks/use-wallet-state";
import { useWalletStore } from "@/store/wallet-store";
import { GetCurrentRoute } from "@/services/bridge/routes";
import { useAaveData } from "@/hooks/use-aave-data";
import { useVaultMetrics } from "@/hooks/use-vault-metrics";
import { useEthereumBalance } from "@/hooks/use-ethereum-balance";
import { executeEthereumDeposit } from "@/services/ethereum/deposit";
import { executeEthereumWithdraw } from "@/services/ethereum/withdraw";
import { parseTokenAmount } from "@/utils/token-amount";
import { isAbortError } from "@/utils/promise";

import type { BridgeMode } from "@/components/bridge/bridge-mode-tabs";
import type { SupportedAsset } from "@/services/ethereum/config";
import type { TransactionResult } from "@/hooks/useBridgeSubmit";

type EthereumSubmitOperation = "deposit" | "withdraw";

function handleEthereumBridgeSubmitError(
  error: unknown,
  operation: EthereumSubmitOperation,
  setSubmitError: (message: string) => void
): boolean {
  if (isAbortError(error)) {
    toast.info("Transfer cancelled");
    return false;
  }

  const title = operation === "deposit" ? "Deposit failed" : "Withdraw failed";
  const message = error instanceof Error ? error.message : title;
  setSubmitError(message);
  toast.error(title, { description: message });
  return true;
}

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
  cancelSubmit: () => void;
  isSubmitting: boolean;
  approvalOpen: boolean;
  setApprovalOpen: (open: boolean) => void;
  submitError: string | null;
  successResult: TransactionResult | null;
  resetSuccessResult: () => void;

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
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<TransactionResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [isClaimModalOpen, setClaimModalOpen] = useState(false);
  const [readyWithdrawalsCount, setReadyWithdrawalsCount] = useState(0);

  const { isMetamaskConnected, isCorrectL1Network, isCorrectViaNetwork, l1Address, viaAddress } = useWalletState();
  const { addLocalTransaction } = useWalletStore();

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

  const prepareSubmissionSigner = useCallback(async () => {
    if (!isAmountValid) {
      const message = amountError || "Invalid amount";
      setSubmitError(message);
      toast.error("Invalid amount", { description: message });
      return null;
    }

    await ensureOnSourceNetwork();

    const walletClient = await getWalletClient(wagmiConfig, { chainId: targetChainId });
    if (!walletClient) throw new Error("Wallet not ready");
    return clientToSigner(walletClient);
  }, [isAmountValid, amountError, ensureOnSourceNetwork, targetChainId]);

  const submitDeposit = useCallback(async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const signer = await prepareSubmissionSigner();
      if (!signer) return;

      setApprovalOpen(true);

      const result = await executeEthereumDeposit({
        asset: selectedAsset,
        amount,
        recipientViaAddress: recipientAddress,
        isYield: isYieldEnabled,
        signer,
        signal: controller.signal,
      });

      const explorerUrl = result.l1ExplorerUrl
        ?? (route.fromNetwork.blockExplorerUrl
          ? `${route.fromNetwork.blockExplorerUrl.replace(/\/+$/, "")}/tx/${result.txHash}`
          : "#");

      addLocalTransaction({
        type: "deposit",
        amount,
        status: "Pending",
        txHash: result.txHash,
        l1ExplorerUrl: explorerUrl === "#" ? undefined : explorerUrl,
        symbol: selectedAsset.symbol,
      });

      setSuccessResult({
        txHash: result.txHash,
        explorerUrl,
        type: "deposit",
        amount,
        tokenSymbol: selectedAsset.symbol,
        sourceNetworkName: route.fromNetwork.displayName,
        destinationNetworkName: route.toNetwork.displayName,
      });

      toast.success("Deposit submitted", { description: `Transaction: ${result.txHash}` });
    } catch (error: unknown) {
      const shouldRethrow = handleEthereumBridgeSubmitError(error, "deposit", setSubmitError);
      if (!shouldRethrow) return;
      throw error;
    } finally {
      setIsSubmitting(false);
      setApprovalOpen(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [prepareSubmissionSigner, selectedAsset, amount, recipientAddress, isYieldEnabled, route, addLocalTransaction]);

  const submitWithdraw = useCallback(async () => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const signer = await prepareSubmissionSigner();
      if (!signer) return;

      setApprovalOpen(true);

      const result = await executeEthereumWithdraw({
        asset: selectedAsset,
        amount,
        recipientEthereumAddress: recipientAddress,
        isYield: isYieldEnabled,
        signer,
        signal: controller.signal,
      });

      const explorerUrl = result.l1ExplorerUrl
        ?? (route.fromNetwork.blockExplorerUrl
          ? `${route.fromNetwork.blockExplorerUrl.replace(/\/+$/, "")}/tx/${result.txHash}`
          : "#");

      addLocalTransaction({
        type: "withdraw",
        amount,
        status: "Pending",
        txHash: result.txHash,
        l2ExplorerUrl: explorerUrl === "#" ? undefined : explorerUrl,
        symbol: selectedAsset.symbol,
      });

      setSuccessResult({
        txHash: result.txHash,
        explorerUrl,
        type: "withdraw",
        amount,
        tokenSymbol: selectedAsset.symbol,
        sourceNetworkName: route.fromNetwork.displayName,
        destinationNetworkName: route.toNetwork.displayName,
      });

      toast.success("Withdrawal submitted!", { description: `Transaction: ${result.txHash}` });
    } catch (error: unknown) {
      const shouldRethrow = handleEthereumBridgeSubmitError(error, "withdraw", setSubmitError);
      if (!shouldRethrow) return;
      throw error;
    } finally {
      setIsSubmitting(false);
      setApprovalOpen(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [prepareSubmissionSigner, selectedAsset, amount, recipientAddress, isYieldEnabled, route, addLocalTransaction]);

  const cancelSubmit = useCallback(() => {
    abortControllerRef.current?.abort();
    setApprovalOpen(false);
  }, []);

  const resetSuccessResult = useCallback(() => {
    setSuccessResult(null);
    setAmount("");
    setRecipientAddress("");
    setSubmitError(null);
  }, []);

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
    cancelSubmit,
    isSubmitting,
    approvalOpen,
    setApprovalOpen,
    submitError,
    successResult,
    resetSuccessResult,
    recipientAddress,
    setRecipientAddress,
    isClaimModalOpen,
    setClaimModalOpen,
    readyWithdrawalsCount,
    setReadyWithdrawalsCount,
  };
}
