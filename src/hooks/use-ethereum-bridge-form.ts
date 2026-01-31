// src/hooks/use-ethereum-bridge-form.ts
import { useCallback, useMemo, useState } from "react";
import { useSwitchChain } from "wagmi";
import { toast } from "sonner";
import { SUPPORTED_ASSETS } from "@/services/ethereum/config";
import { useWalletState } from "@/hooks/use-wallet-state";
import { GetCurrentRoute } from "@/services/bridge/routes";
import { useAaveData } from "@/hooks/use-aave-data";
import { useVaultMetrics } from "@/hooks/use-vault-metrics";
import { useEthereumBalance } from "@/hooks/use-ethereum-balance";
import { useEthersSigner } from "@/hooks/use-ethers-signer";
import { executeEthereumDeposit } from "@/services/ethereum/deposit";
import { executeEthereumWithdraw } from "@/services/ethereum/withdraw";
import { switchToEthereumNetwork, switchToL2Network } from "@/utils/network-switcher";
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
  handleAmountChange: (value: string) => void;
  handleMax: () => void;
  handleSliderChange: (value: number) => void;

  route: ReturnType<typeof GetCurrentRoute>
  isSwitchingNetwork: boolean;
  switchRouteNetwork: () => Promise<void>;

  balance: string | null;
  walletBalance: number;
  isLoadingBalance: boolean;
  refreshBalance: () => void;

  aaveApys: Record<string, number>;
  isLoadingApy: boolean;
  vaultMetrics: ReturnType<typeof useVaultMetrics>["metrics"];
  isLoadingMetrics: boolean;

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

// export function useEthereumBridgeForm(): UseEthereumBridgeFormResult {
//   const [mode, setMode] = useState<BridgeMode>("deposit");
//   const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<string>("USDC");
//   const [isYieldEnabled, setIsYieldEnabled] = useState(false);
//   const [amount, setAmount] = useState("");
//   const [recipientAddress, setRecipientAddress] = useState("");
//   const [isClaimModalOpen, setClaimModalOpen] = useState(false);
//   const [readyWithdrawalsCount, setReadyWithdrawalsCount] = useState(0);
//
//   const { isMetaMaskConnected, isCorrectL1Network, isCorrectViaNetwork, l1Address, viaAddress } = useWalletState();
//
//   const selectedAsset = useMemo(
//     () => SUPPORTED_ASSETS.find((a) => a.symbol === selectedAssetSymbol) || defaultAsset,
//     [defaultAsset, selectedAssetSymbol]
//   );
//
//   const route = useMemo(() => GetCurrentRoute(mode, "ethereum"), [mode]);
//   const targetChainId = route.fromNetwork.chainId!;
//
//   const swichToRouteNetwork = useCallback(async () => {
//     try {
//       await switchChainAsync({ chainId: targetChainId });
//     } catch (error: unknown) {
//       const switchError = error as { code?: number; message?: string };
//       if (switchError.code === 4902 || switchError?.message?.includes("chain")) {
//         if (mode === "deposit") {
//           await switchToEthereumNetwork()
//         } else {
//           await switchToL2Network()
//         }
//       }
//     }
//   })
//
//
// }