import { ethers } from "ethers";
import { Provider } from "via-ethers";
import { getNetworkConfig } from "../config";
import { L2_BTC_DECIMALS } from "../constants";

/**
 * Fetches the BTC balance on VIA network for a given address
 */
export async function getViaBalance(address: string): Promise<string> {
  try {
    // Connect to the VIA network
    const provider = new Provider(getNetworkConfig().rpcUrls[0]);

    // Get BTC balance on VIA
    const balanceWei = await provider.getBalance(address);

    // Convert from wei to BTC (18 decimals)
    const balanceInBtc = ethers.formatUnits(balanceWei, L2_BTC_DECIMALS);

    return balanceInBtc;
  } catch (error) {
    console.error("Failed to get VIA balance:", error);
    throw error;
  }
}