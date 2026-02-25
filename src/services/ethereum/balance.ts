// src/services/ethereum/balance.ts
import { isError } from "ethers";
import { ERC20_ABI } from "./abis";
import { isContractDeployed } from "./contract";

/**
 * Represents the result of a balance fetching operation.
 *
 * Properties:
 * - `balance`: A string representing the fetched balance, or null if unavailable.
 * - `error`: A string describing any error encountered during the fetch, or null if no errors occurred.
 */
export interface BalanceFetchResult {
  balance: string | null;
  error: string | null;
}

/**
 * Fetches the ERC20 token balance for a given wallet address.
 *
 * @param provider - EIP-1193 provider to use (must be on the correct network)
 * @param tokenAddress - The contract address of the ERC20 token.
 * @param walletAddress - The address of the wallet for which the balance is being retrieved.
 * @param decimals - The number of decimals used by the token for formatting its balance.
 * @return A promise that resolves to an object containing the balance or an error message.
 */
export async function getERC20Balance(
  provider: EIP1193Provider,
  tokenAddress: string,
  walletAddress: string,
  decimals: number
): Promise<BalanceFetchResult> {
  if (typeof window === "undefined") return { balance: null, error: "No ethereum provider" };

  try {
    // Check if the contract exists first
    const contractExists = await isContractDeployed(provider, tokenAddress);
    if (!contractExists) {
      console.warn(`No contract deployed at ${tokenAddress} on current network`);
      return { balance: null, error: "Contract does not exist" };
    }

    const { BrowserProvider, Contract, formatUnits } = await import("ethers");
    const browserProvider = new BrowserProvider(provider);
    const tokenContract = new Contract(tokenAddress, ERC20_ABI, browserProvider);
    const balance = await tokenContract.balanceOf(walletAddress);
    const balanceFormatted = formatUnits(balance, decimals);

    return { balance: balanceFormatted, error: null };
  } catch (err) {
    if (isError(err, "BAD_DATA")) {
      console.warn(`Contract at ${tokenAddress} may not implement balanceOf or is not an ERC20 token`);
      return { balance: null, error: "Contract does not implement balanceOf" };
    }
    console.error("Error fetching balance:", err);
    return { balance: null, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
