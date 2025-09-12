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