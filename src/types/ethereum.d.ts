interface EIP6963ProviderInfo {
  rdns: string;
  uuid: string;
  name: string;
  icon: string;
}

interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: EIP1193Provider;
}

interface EIP6963AnnounceProviderEvent extends CustomEvent {
  detail: EIP6963ProviderDetail;
}

interface EIP1193Provider {
  isStatus?: boolean;
  host?: string;
  path?: string;
  sendAsync?: (
    request: { method: string; params?: Array<unknown> },
    callback: (error: Error | null, response: unknown) => void
  ) => void;
  send?: (
    request: { method: string; params?: Array<unknown> },
    callback: (error: Error | null, response: unknown) => void
  ) => void;
  request: (request: {
    method: string;
    params?: Array<unknown>;
  }) => Promise<unknown>;

  // Wallet-specific flags
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isTrust?: boolean;

  // Wallet-specific APIs
  _metamask?: any;
  qrUrl?: string; // Coinbase specific

  // event emitter methods
  on?: (event: string, callback: (...args: any[]) => void) => void;
  removeListener?: (event: string, callback: (...args: any[]) => void) => void;
} 

// WalletProviderState with additional properties for state management
interface WalletProviderState extends EIP1193Provider {
    isConnected?: boolean;
    lastUsed?: Date;
    userPreferred?: boolean; // Maybe we want this but this could also be annoying for users who like to use different wallets for some preferred reason
    conflictsWith?: string[]; // List of other providers that conflict with this one
}

interface WalletPreference {
    preferredWallet?: string // rdns (e.g. io.metamask)
    autoConnect?: boolean;
    rememberChoice: boolean;
}

// Provider conflict detection
interface ConflictReport {
  hasConflicts: boolean;
  conflictingProviders: Array<{rdns: string, name: string, conflictType: 'duplicate' | 'override' | 'injection'}>
  recommendations: string[];
}

// Extend the global Window interface
declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
  
  interface WindowEventMap {
    'eip6963:announceProvider': EIP6963AnnounceProviderEvent;
  }
}