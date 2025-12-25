// src/utils/evm-account-selection.ts
/**
 * EVM Account Selection Utilities
 * 
 * Handles account selection and account change listening for EVM wallets.
 * Should work with all EIP-1193 compatible wallets
 */

import { maskAddress } from "@/utils/address";

/**
 * Request wallet to show its account selection popup
 * This uses wallet_requestPermissions which forces wallets like MetaMask to show the account picker
 * For wallets that don't support this method, it gracefully falls back to normal connection
 * 
 * @param provider - The EIP-1193 provider instance
 * @returns The selected account address, or null if user cancelled, or undefined to skip (fallback)
 */
export async function requestWalletAccountSelection(provider: EIP1193Provider): Promise<string | null | undefined> {
  try {
    // wallet_requestPermissions forces wallets to show account selection
    await provider.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });
    
    // After permission granted, get the accounts
    const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
    return accounts[0] ?? null;
  } catch (error: any) {
    // User rejected the request
    if (error?.code === 4001) {
      console.log('User rejected account selection');
      return null;
    }
    // Wallet doesn't support wallet_requestPermissions - fall back to normal connection
    if (error?.code === -32601 || error?.code === 4200 || error?.message?.includes('not supported')) {
      console.log('Wallet does not support wallet_requestPermissions, using normal connection');
      return undefined; // Signal to continue with normal connection
    }
    // For other errors, log and fall back to normal connection
    console.warn('wallet_requestPermissions failed, falling back to normal connection:', error);
    return undefined;
  }
}

/**
 * Listener state for cleanup
 */
let currentListener: ((accounts: string[]) => void) | null = null;
let currentProvider: EIP1193Provider | null = null;

/**
 * Set up accountsChanged listener on the provider
 * This keeps the app in sync when user switches accounts in their wallet
 *
 * @param provider - The EIP-1193 provider instance
 * @param walletName - Name of the wallet for logging
 * @param onAccountChange - Callback when account changes
 */
export function setupAccountsChangedListener(
  provider: EIP1193Provider,
  walletName: string,
  onAccountChange: (address: string | null) => void
): void {
  // Clean up any existing listener first
  cleanupAccountsChangedListener();
  
  currentListener = (accounts: string[]) => {
    const newAddress = accounts[0] ?? null;
    console.log('Account changed in wallet:', newAddress ? maskAddress(newAddress) : 'disconnected');
    onAccountChange(newAddress);
  };
  
  currentProvider = provider;
  provider.on?.('accountsChanged', currentListener);
  console.log(`Set up accountsChanged listener for ${walletName}`);
}

/**
 * Clean up the accountsChanged listener
 * Should be called on disconnect
 */
export function cleanupAccountsChangedListener(): void {
  if (currentListener && currentProvider) {
    try {
      currentProvider.removeListener?.('accountsChanged', currentListener);
      console.log('Cleaned up accountsChanged listener');
    } catch {
      // Ignore errors during cleanup
    }
    currentListener = null;
    currentProvider = null;
  }
}
