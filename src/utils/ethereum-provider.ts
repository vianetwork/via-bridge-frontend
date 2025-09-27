import { eip6963Store } from './eip6963-provider';
import { resolveDisplayName } from './wallet-metadata';

/**
 * Safely get the MetaMask provider, avoiding conflicts with other wallet extensions
 * @returns MetaMask provider or null if not found
 */
export const getMetaMaskProvider = (): EIP1193Provider | null => {
  // First, try to get MetaMask via EIP-6963
  const eip6963Provider = eip6963Store.getMetaMaskProvider();
  if (eip6963Provider) {
    return eip6963Provider.provider;
  }

  return null;
};


/**
 * Safely get the Rabby provider, avoiding conflicts with other wallet extensions
 * @returns Rabby provider or null if not found
 */
export const getRabbyProvider = (): EIP1193Provider | null => {
  const eip6963Provider = eip6963Store.getRabbyProvider();
  if (eip6963Provider) {
    return eip6963Provider.provider;
  }

  return null;
};

/**
 * Safely get the Coinbase Wallet Provider
 * @returns Coinbase Wallet provider or null if not found
 */
export const getCoinbaseProvider = (): EIP1193Provider | null => {
  const eip6963Provider = eip6963Store.getCoinbaseProvider();
  if (eip6963Provider) {
    return eip6963Provider.provider;
  }
  return null;
}

/**
 * Get all available wallet providers discovered in the browser
 * @return Array of EIP6963ProviderDetail
 */
export const getAllWalletProviders = (): EIP6963ProviderDetail[] => {
  return eip6963Store.getAllWalletProviders();
};

/**
 * Get the preferred Web3 wallet provider based on priority
 * Prioritizes MetaMask, then Rabby, then any other EIP-6963 wallet
 * Chain-agnostic provider selection for Web3 wallets
 */
export const getPreferredWeb3Provider = (): { provider: EIP1193Provider; name: string; rdns: string } | null => {
  console.log('getPreferredWeb3Provider: Searching for preferred web 3 wallet...');
  
  // Try MetaMask first
  const metamask = eip6963Store.getMetaMaskProvider();
  if (metamask) {
    const displayName = resolveDisplayName(metamask);
    console.log('getPreferredWeb3Provider: Web3 wallet found with provider details:', {
      name: displayName,
      rdns: metamask.info.rdns,
      hasProvider: !!metamask.provider
    });
    return { provider: metamask.provider, name: displayName, rdns: metamask.info.rdns };
  }
  
  // Try Rabby second
  const rabby = eip6963Store.getRabbyProvider();
  if (rabby) {
    const displayName = resolveDisplayName(rabby);
    console.log('getPreferredWeb3Provider: Web3 wallet found with provider details:', {
      name: displayName,
      rdns: rabby.info.rdns,
      hasProvider: !!rabby.provider
    });
    return { provider: rabby.provider, name: displayName, rdns: rabby.info.rdns };
  }

  const coinbase = eip6963Store.getCoinbaseProvider();
  if (coinbase) {
    const displayName = resolveDisplayName(coinbase);
    console.log('getPreferredWeb3Provider: Web3 wallet found with provider details:', {
      name: displayName,
      rdns: coinbase.info.rdns,
      hasProvider: !!coinbase.provider
    });
    return { provider: coinbase.provider, name: displayName, rdns: coinbase.info.rdns };
  }
  
  // Try any other EIP-6963 wallet
  const allProviders = eip6963Store.getAllWalletProviders();
  if (allProviders.length > 0) {
    const firstProvider = allProviders[0];
    console.log('getPreferredWeb3Provider: Using', firstProvider.info.name, 'as fallback');
    return { provider: firstProvider.provider, name: firstProvider.info.name, rdns: firstProvider.info.rdns };
  }
  
  console.log('getPreferredWeb3Provider: No Web3 providers found');
  return null;
};

/**
 * Async version of getPreferredWeb3Provider that waits for providers to be ready
 * @param timeout - Maximum time to wait for providers (default: 5000ms)
 * @returns The preferred provider or null if none found
 */
export const getPreferredWeb3ProviderAsync = async (
  timeout: number = 5000
): Promise<{ provider: EIP1193Provider; name: string; rdns: string } | null> => {
  await eip6963Store.waitForProviders(timeout);
  return getPreferredWeb3Provider();
};
