/**
 * Mask a wallet address for logging/display.
 * Examples:
 * - maskAddress("0xA1B2C3D4E5F6G7H8I9J0") => "0xA1B2C3...9J0"
 * - maskAddress("bc1qxyz...") => "bc1qxy...xyz"
 */
export function maskAddress(address: string, visibleStart = 6, visibleEnd = 4): string {
  if (!address) return "";
  const len = address.length;
  const minLen = visibleStart + visibleEnd + 3; // +3 for "..."
  if (len <= minLen) return address;
  return `${address.slice(0, visibleStart)}...${address.slice(-visibleEnd)}`;
}

/**
 * Helper to mask an array of addresses.
 */
export function maskAddresses(addresses: string[], visibleStart = 6, visibleEnd = 4): string[] {
  return addresses.map((a) => maskAddress(a, visibleStart, visibleEnd));
}

/**
 * Verify a Bitcoin address (simple bech32 length/prefix check).
 * Supports bc1 (mainnet), tb1 (testnet), and bcr (regtest).
 * NOTE: This mirrors the current zod refine used in forms. Replace with a full bech32 decoded if needed later.
 */
export function verifyBitcoinAddress(address: string): boolean {
  if (!address) return false;
  if (address.startsWith("bc1") || address.startsWith("tb1") || address.startsWith("bcr")) {
    const len = address.length;
    return len >= 42 && len <= 62;
  }
  return false;
}
