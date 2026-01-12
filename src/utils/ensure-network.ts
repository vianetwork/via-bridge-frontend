import { ethers, BrowserProvider } from "ethers";
import { switchToL2Network, switchToEthereumNetwork } from "./network-switcher";
import { getNetworkConfig } from "@/services/config";

export interface EnsureNetworkResult {
  success: boolean;
  error?: string;
  provider?: BrowserProvider;
  signer?: ethers.JsonRpcSigner;
}

/**
 * Ensures the wallet is on the correct network and returns a ready-to-use provider and signer.
 * This is a unified helper for both deposit and withdrawal flows.
 * 
 * Network selection is environment-aware:
 * - VIA: Uses BRIDGE_CONFIG.defaultNetwork to determine testnet vs mainnet
 * - Ethereum: Uses BRIDGE_CONFIG.defaultNetwork to determine Sepolia vs Mainnet
 */
export async function ensureNetworkForTransaction(
  networkType: "via" | "ethereum"
): Promise<EnsureNetworkResult> {
  try {
    // Validate window.ethereum is available
    if (typeof window === "undefined" || !window.ethereum) {
      return {
        success: false,
        error: "Wallet not found. Please install a compatible wallet extension.",
      };
    }

    // Switch network based on type (both are now environment-aware)
    let networkSwitchResult;
    if (networkType === "via") {
      const networkConfig = getNetworkConfig();
      networkSwitchResult = await switchToL2Network(networkConfig.chainId);
    } else {
      // switchToEthereumNetwork is now environment-aware (uses BRIDGE_CONFIG.defaultNetwork)
      networkSwitchResult = await switchToEthereumNetwork();
    }

    if (!networkSwitchResult.success) {
      return {
        success: false,
        error:
          networkSwitchResult.error ||
          `Please switch your wallet to the correct network manually.`,
      };
    }

    // Create provider and signer after network switch
    // Wait a bit to ensure network switch is complete
    if (networkSwitchResult.switched) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const browserProvider = new BrowserProvider(window.ethereum);
    const signer = await browserProvider.getSigner();

    return {
      success: true,
      provider: browserProvider,
      signer,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Failed to ensure network connection",
    };
  }
}

/**
 * Convenience function for ensuring VIA (L2) network
 */
export async function ensureViaNetwork(): Promise<EnsureNetworkResult> {
  return ensureNetworkForTransaction("via");
}

/**
 * Convenience function for ensuring Ethereum (L1) network.
 * Network selection is environment-aware based on BRIDGE_CONFIG.defaultNetwork.
 */
export async function ensureEthereumNetwork(): Promise<EnsureNetworkResult> {
  return ensureNetworkForTransaction("ethereum");
}
