import { useState, useCallback } from "react";
import {
  switchNetwork,
  switchToL1Network,
  switchToL2Network,
  switchToEthereumNetwork,
  NetworkSwitchConfig,
  NetworkSwitchResult,
} from "@/utils/network-switcher";
import { EthereumNetwork } from "@/services/ethereum/config";

export interface UseNetworkSwitcherReturn {
  isSwitching: boolean;
  switchNetwork: (config: NetworkSwitchConfig) => Promise<NetworkSwitchResult>;
  switchToL1: (targetNetwork?: string) => Promise<NetworkSwitchResult>;
  switchToL2: (targetChainId?: string) => Promise<NetworkSwitchResult>;
  switchToEthereum: (
    targetNetwork?: EthereumNetwork
  ) => Promise<NetworkSwitchResult>;
  status: string;
  error: string | null;
}

/**
 * React hook for network switching with loading states and error handling
 */
export function useNetworkSwitcher(): UseNetworkSwitcherReturn {
  const [isSwitching, setIsSwitching] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSwitch = useCallback(
    async (config: NetworkSwitchConfig): Promise<NetworkSwitchResult> => {
      setIsSwitching(true);
      setError(null);
      setStatus("");

      try {
        const result = await switchNetwork({
          ...config,
          onStatusUpdate: setStatus,
        });

        if (!result.success) {
          setError(result.error || "Network switch failed");
        } else {
          setStatus("");
        }

        return result;
      } catch (err: any) {
        const errorMessage = err?.message || "Network switch failed";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          switched: false,
        };
      } finally {
        setIsSwitching(false);
      }
    },
    []
  );

  const handleSwitchToL1 = useCallback(
    async (targetNetwork?: string): Promise<NetworkSwitchResult> => {
      setIsSwitching(true);
      setError(null);
      setStatus("");

      try {
        const result = await switchToL1Network(targetNetwork, setStatus);
        if (!result.success) {
          setError(result.error || "Network switch failed");
        } else {
          setStatus("");
        }
        return result;
      } catch (err: any) {
        const errorMessage = err?.message || "Network switch failed";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          switched: false,
        };
      } finally {
        setIsSwitching(false);
      }
    },
    []
  );

  const handleSwitchToL2 = useCallback(
    async (targetChainId?: string): Promise<NetworkSwitchResult> => {
      setIsSwitching(true);
      setError(null);
      setStatus("");

      try {
        const result = await switchToL2Network(targetChainId, setStatus);
        if (!result.success) {
          setError(result.error || "Network switch failed");
        } else {
          setStatus("");
        }
        return result;
      } catch (err: any) {
        const errorMessage = err?.message || "Network switch failed";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          switched: false,
        };
      } finally {
        setIsSwitching(false);
      }
    },
    []
  );

  const handleSwitchToEthereum = useCallback(
    async (
      targetNetwork: EthereumNetwork = EthereumNetwork.SEPOLIA
    ): Promise<NetworkSwitchResult> => {
      setIsSwitching(true);
      setError(null);
      setStatus("");

      try {
        const result = await switchToEthereumNetwork(targetNetwork, setStatus);
        if (!result.success) {
          setError(result.error || "Network switch failed");
        } else {
          setStatus("");
        }
        return result;
      } catch (err: any) {
        const errorMessage = err?.message || "Network switch failed";
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          switched: false,
        };
      } finally {
        setIsSwitching(false);
      }
    },
    []
  );

  return {
    isSwitching,
    switchNetwork: handleSwitch,
    switchToL1: handleSwitchToL1,
    switchToL2: handleSwitchToL2,
    switchToEthereum: handleSwitchToEthereum,
    status,
    error,
  };
}

