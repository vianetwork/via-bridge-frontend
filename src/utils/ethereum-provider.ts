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
