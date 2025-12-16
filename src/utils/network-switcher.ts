import { Layer, VIA_NETWORK_CONFIG, BRIDGE_CONFIG } from "@/services/config";
import { ETHEREUM_NETWORK_CONFIG, EthereumNetwork } from "@/services/ethereum/config";
import { getPreferredWeb3ProviderAsync } from "@/utils/ethereum-provider";
import { eip6963Store } from "@/utils/eip6963-provider";
import { useWalletStore } from "@/store/wallet-store";

export type NetworkType = "bitcoin" | "via" | "ethereum";

export interface NetworkSwitchConfig {
  networkType: NetworkType;
  targetNetwork?: string; // For Bitcoin: "mainnet" | "testnet4" | "regtest", for EVM: chainId
  targetChainId?: string; // For EVM networks: hex chainId
  networkConfig?: any; // Full network config for EVM (for wallet_addEthereumChain)
  onStatusUpdate?: (status: string) => void;
}

export interface NetworkSwitchResult {
  success: boolean;
  error?: string;
  switched: boolean; // Whether a switch actually occurred (false if already on correct network)
}

/**
 * Switches to the specified Bitcoin network using Xverse/Sats Connect
 */
async function switchBitcoinNetwork(
  targetNetwork: string,
  onStatusUpdate?: (status: string) => void
): Promise<NetworkSwitchResult> {
  try {
    const { isXverseConnected } = useWalletStore.getState();
    if (!isXverseConnected) {
      return {
        success: false,
        error: "Xverse wallet not connected",
        switched: false,
      };
    }

    onStatusUpdate?.("Switching Bitcoin network...");

    const { request } = await import("sats-connect");

    // Map network name to Xverse format
    const toXverseName = (net: string): string => {
      switch (net.toLowerCase()) {
        case "mainnet":
          return "Mainnet";
        case "testnet4":
        case "testnet":
          return "Testnet4";
        case "regtest":
          return "Regtest";
        default:
          return net;
      }
    };

    const targetName = toXverseName(targetNetwork);

    try {
      const res: any = await request("wallet_changeNetwork", {
        name: targetName,
      } as any);

      if (res?.status === "success") {
        // Refresh connection state
        await useWalletStore.getState().checkXverseConnection();
        return {
          success: true,
          switched: true,
        };
      } else {
        return {
          success: false,
          error: res?.error?.message || "Failed to switch network",
          switched: false,
        };
      }
    } catch (e: any) {
      console.error("wallet_changeNetwork failed", e);
      return {
        success: false,
        error: e?.message || "Network switch failed",
        switched: false,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to switch Bitcoin network",
      switched: false,
    };
  }
}

/**
 * Switches to the specified EVM network (VIA or Ethereum)
 */
async function switchEvmNetwork(
  targetChainId: string,
  networkConfig?: any,
  onStatusUpdate?: (status: string) => void
): Promise<NetworkSwitchResult> {
  try {
    // Get the provider (prefer selected wallet, fallback to best available)
    const { selectedWallet } = useWalletStore.getState();
    let provider: EIP1193Provider | null = null;

    if (selectedWallet) {
      const detail = eip6963Store.getProviderByRdns(selectedWallet);
      if (detail) {
        provider = detail.provider;
      }
    }

    if (!provider) {
      const bestProvider = await getPreferredWeb3ProviderAsync();
      if (!bestProvider) {
        return {
          success: false,
          error: "No EVM wallet found",
          switched: false,
        };
      }
      provider = bestProvider.provider;
    }

    // Check current chain
    const currentChainId = (await provider.request({
      method: "eth_chainId",
    })) as string;

    // Normalize chain IDs for comparison
    const normalizeChainId = (id: string): string => {
      if (id.startsWith("0x")) {
        return id.toLowerCase();
      }
      return `0x${parseInt(id).toString(16)}`;
    };

    const normalizedCurrent = normalizeChainId(currentChainId);
    const normalizedTarget = normalizeChainId(targetChainId);

    // Already on correct network
    if (normalizedCurrent === normalizedTarget) {
      return {
        success: true,
        switched: false,
      };
    }

    onStatusUpdate?.("Switching network...");

    try {
      // Try to switch
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: normalizedTarget }],
      });

      // Wait a bit for the switch to complete
      await new Promise((resolve) => setTimeout(resolve, 2000));

      return {
        success: true,
        switched: true,
      };
    } catch (switchError: any) {
      // Error code 4902 means the chain hasn't been added to the wallet
      if (switchError.code === 4902 && networkConfig) {
        onStatusUpdate?.("Adding network to wallet...");
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [networkConfig],
          });

          await new Promise((resolve) => setTimeout(resolve, 2000));

          return {
            success: true,
            switched: true,
          };
        } catch (addError: any) {
          return {
            success: false,
            error:
              addError?.message ||
              "Failed to add network. Please add it manually in your wallet.",
            switched: false,
          };
        }
      }

      // Other switch errors
      return {
        success: false,
        error:
          switchError?.message ||
          "Failed to switch network. Please switch manually in your wallet.",
        switched: false,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to switch EVM network",
      switched: false,
    };
  }
}

/**
 * Main network switching function that handles all network types
 */
export async function switchNetwork(
  config: NetworkSwitchConfig
): Promise<NetworkSwitchResult> {
  const { networkType, targetNetwork, targetChainId, networkConfig, onStatusUpdate } =
    config;

  switch (networkType) {
    case "bitcoin": {
      if (!targetNetwork) {
        // Use default from config
        const network = BRIDGE_CONFIG.defaultNetwork;
        return switchBitcoinNetwork(network, onStatusUpdate);
      }
      return switchBitcoinNetwork(targetNetwork, onStatusUpdate);
    }

    case "via": {
      if (!targetChainId) {
        // Use default from config
        const network = BRIDGE_CONFIG.defaultNetwork;
        const chainId = VIA_NETWORK_CONFIG[network].chainId;
        const networkConfig = VIA_NETWORK_CONFIG[network];
        return switchEvmNetwork(chainId, networkConfig, onStatusUpdate);
      }
      return switchEvmNetwork(
        targetChainId,
        networkConfig || VIA_NETWORK_CONFIG[BRIDGE_CONFIG.defaultNetwork],
        onStatusUpdate
      );
    }

    case "ethereum": {
      if (!targetChainId) {
        // Default to Sepolia
        const sepoliaConfig = ETHEREUM_NETWORK_CONFIG[EthereumNetwork.SEPOLIA];
        return switchEvmNetwork(sepoliaConfig.chainId, sepoliaConfig, onStatusUpdate);
      }
      return switchEvmNetwork(
        targetChainId,
        networkConfig || ETHEREUM_NETWORK_CONFIG[EthereumNetwork.SEPOLIA],
        onStatusUpdate
      );
    }

    default:
      return {
        success: false,
        error: `Unsupported network type: ${networkType}`,
        switched: false,
      };
  }
}

/**
 * Convenience function to switch to L1 (Bitcoin) network
 */
export async function switchToL1Network(
  targetNetwork?: string,
  onStatusUpdate?: (status: string) => void
): Promise<NetworkSwitchResult> {
  return switchNetwork({
    networkType: "bitcoin",
    targetNetwork: targetNetwork || BRIDGE_CONFIG.defaultNetwork,
    onStatusUpdate,
  });
}

/**
 * Convenience function to switch to L2 (VIA) network
 */
export async function switchToL2Network(
  targetChainId?: string,
  onStatusUpdate?: (status: string) => void
): Promise<NetworkSwitchResult> {
  const network = BRIDGE_CONFIG.defaultNetwork;
  const chainId = targetChainId || VIA_NETWORK_CONFIG[network].chainId;
  const networkConfig = VIA_NETWORK_CONFIG[network];

  return switchNetwork({
    networkType: "via",
    targetChainId: chainId,
    networkConfig,
    onStatusUpdate,
  });
}

/**
 * Convenience function to switch to L1 Ethereum network (e.g., Sepolia)
 */
export async function switchToEthereumNetwork(
  targetNetwork: EthereumNetwork = EthereumNetwork.SEPOLIA,
  onStatusUpdate?: (status: string) => void
): Promise<NetworkSwitchResult> {
  const networkConfig = ETHEREUM_NETWORK_CONFIG[targetNetwork];

  return switchNetwork({
    networkType: "ethereum",
    targetChainId: networkConfig.chainId,
    networkConfig,
    onStatusUpdate,
  });
}

