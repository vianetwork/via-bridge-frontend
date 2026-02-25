/**
 * Checks if a contract is deployed at the given address on the current network.
 * Uses provider.getCode() - returns "0x" if no contract exists.
 *
 * @param provider - EIP-1193 provider to use for the RPC call
 * @param address - The contract address to check
 * @returns Promise<boolean> - true if contract exists, false otherwise
 */
export async function isContractDeployed(provider: EIP1193Provider, address: string): Promise<boolean> {
  if (typeof window === "undefined") return false;

  try {
    const { BrowserProvider } = await import("ethers");
    const browserProvider = new BrowserProvider(provider);
    const code = await browserProvider.getCode(address);
    return code !== "0x";
  } catch (err) {
    console.error("Error checking contract deployment:", err);
    return false;
  }
}
