// Utility to safely handle multiple Ethereum providers and avoid conflicts

/**
 * Interface for Ethereum provider 
 * @property {boolean} isMetaMask - Whether the provider is MetaMask
 * @property {boolean} isXverse - Whether the provider is Xverse
 * @property {boolean} isCoinbaseWallet - Whether the provider is Coinbase Wallet
 * @property {function} request - Function to send a request to the provider
 * @property {function} on - Function to listen for events from the provider
 * @property {function} removeListener - Function to remove an event listener from the provider
 */
interface EthereumProvider {
  isMetaMask?: boolean;
  isXverse?: boolean;
  isCoinbaseWallet?: boolean; // Not supported yet but placeholder example for future support of Coinbase and or any other wallets
  request: (request: { method: string; params?: any[] }) => Promise<any>;
  on: (eventName: string, callback: (...args: any[]) => void) => void;
  removeListener: (eventName: string, callback: (...args: any[]) => void) => void;
}


/**
 * Safely get the MetaMask provider, avoiding conflicts with other wallet extensions
 * @returns MetaMask provider or null if not found
 */
export function getMetaMaskProvider(): EthereumProvider | null {
  if (typeof window === "undefined") return null;

  // Check if there are multiple providers
  const providers = getAllEthereumProviders();
  console.log("🔍 Found Ethereum providers:", providers.map(p => getProviderName(p)));

  // Try to find MetaMask specifically
  const metaMaskProvider = providers.find(provider => provider.isMetaMask === true);
  
  if (metaMaskProvider) {
    console.log("✅ Found MetaMask provider");
    return metaMaskProvider;
  }

  // Fallback to window.ethereum if it's MetaMask
  if (window.ethereum?.isMetaMask) {
    console.log("✅ Using window.ethereum as MetaMask provider");
    return window.ethereum;
  }

  console.log("❌ MetaMask provider not found");
  return null;
}

/**
 * Get all available Ethereum providers
 * @returns Array of Ethereum providers
 */
function getAllEthereumProviders(): EthereumProvider[] {
  if (typeof window === "undefined") return [];

  const providers: EthereumProvider[] = [];

  // Check window.ethereum
  if (window.ethereum) {
    providers.push(window.ethereum);
  }

  // Check for providers array (some wallets expose multiple providers this way)
  const ethereumProviders = (window.ethereum as any)?.providers;
  if (Array.isArray(ethereumProviders)) {
    providers.push(...ethereumProviders);
  }

  return providers;
}

/**
 * Get a readable name for a provider
 * @param provider Ethereum provider
 * @returns Readable name of the provider
 */
function getProviderName(provider: EthereumProvider): string {
  if (provider.isMetaMask) return "MetaMask";
  if (provider.isXverse) return "Xverse";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  return "Unknown";
}

/**
 * Check if there are conflicting Ethereum providers
 * @returns True if there are multiple providers, false otherwise
 */
export function checkForProviderConflicts(): boolean {
  const providers = getAllEthereumProviders();
  
  if (providers.length > 1) {
    console.warn("⚠️ Multiple Ethereum providers detected:", providers.map(p => getProviderName(p)));
    return true;
  }
  
  return false;
}

/**
 * Safely set up Ethereum provider event listeners
 * @param eventName Name of the event to listen for
 * @param callback Callback function to execute when the event is triggered
 * @returns Cleanup function to remove the listener
 */
export function setupEthereumListeners(
  eventName: string,
  callback: (...args: any[]) => void
): (() => void) | null {
  const provider = getMetaMaskProvider();
  
  if (!provider) {
    console.warn("❌ Cannot set up Ethereum listeners: no provider found");
    return null;
  }

  try {
    provider.on(eventName, callback);
    
    // Return cleanup function
    return () => {
      try {
        provider.removeListener(eventName, callback);
      } catch (error) {
        console.warn("Warning: Failed to remove Ethereum event listener:", error);
      }
    };
  } catch (error) {
    console.error("Failed to set up Ethereum event listener:", error);
    return null;
  }
}