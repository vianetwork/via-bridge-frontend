import { Eip6963ProviderInfo } from 'ethers';
import { eip6963Store } from './eip6963-provider';

/**
 * Safely get the MetaMask provider, avoiding conflicts with other wallet extensions
 * @returns MetaMask provider or null if not found
 */
export const getMetaMaskProvider = (): EIP1193Provider | null => {
  // First, try to get MetaMask via EIP-6963
  const eip6963Provider = eip6963Store.getMetaMaskProvider();
  if (eip6963Provider) {
    console.log('✅ Found MetaMask via EIP-6963');
    return eip6963Provider.provider;
  }

  // Fallback to traditional detection
  if (typeof window !== 'undefined' && window.ethereum) {
    // Check if it's actually MetaMask
    if (window.ethereum.isMetaMask) {
      console.log('✅ Found MetaMask via window.ethereum');
      return window.ethereum;
    }
  }

  console.log('❌ MetaMask provider not found');
  return null;
};

/**
 * Safely get the Rabby provider, avoiding conflicts with other wallet extensions
 * @returns Rabby provider or null if not found
 */
export const getRabbyProvider = (): EIP1193Provider | null => {
  // First try to get Rabby via EIP-6963
  const eip6963Provider = eip6963Store.getRabbyProvider();
  if (eip6963Provider) {
    console.log('✅ Found Rabby via EIP-6963');
    return eip6963Provider.provider;
  }

  console.log('❌ Rabby provider not found');
  return null;
};

/**
 * Safely get the Coinbase Wallet Provider
 * @returns Coinbase Wallet provider or null if not found
 */
export const getCoinbaseProvider = (): EIP1193Provider | null => {
  const eip6963 = eip6963Store.getCoinbaseProvider();
  if (eip6963) {
    console.log('✅ Found Coinbase via EIP-6963');
    return eip6963.provider;
  }

  console.log('❌ Coinbase provider not found');
  return null;
}

/**
 * Get all available wallet providers discovered in the browser
 * @return Array of EIP6963ProviderDetail
 */
export const getAllWalletProviders = (): EIP6963ProviderDetail[] => {
  return eip6963Store.getAllWalletProviders();
};