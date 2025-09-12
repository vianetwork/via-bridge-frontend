import WalletConnectButton from "@/components/wallet-connect-button";
import { walletTypes } from "sats-connect";

/**
 * Wallet-specific error types
 */
export class WalletError extends Error {
  constructor(
    message: string,
    public code: string,
    public WalletType?: string,
    public userMessage?: string,
  ) {
    super(message);
    this.name = 'WalletError'
  }
}

export class WalletNotFoundError extends WalletError {
  constructor(walletType: string) {
    super(
      `${walletType} wallet not found`,
      `WALLET_NOT_FOUND`,
      walletType,
      `${walletType} is not installed. Please install ${walletType} wallet extension`
    );
    this.name = 'WalletNotFoundError'
  }
}

export class UserRejectedError extends WalletError {
  constructor(walletType: string) {
    super(
      `User rejected connection request in ${walletType}`,
      'USER_REJECTED',
      walletType,
      'Connection request was cancelled. Please try again and approve connection'
    );
    this.name = 'UserRejectedError'
  }
}

export class NetworkError extends WalletError {
  constructor(expectedNetwork: string, currentNetwork: string, walletType: string) {
    super(
      `Wrong network: expected ${expectedNetwork}, but connected to ${currentNetwork}`,
      'WRONG_NETWORK',
      walletType,
      `Please switch to ${expectedNetwork} network in ${walletType} wallet`
    );
    this.name = 'NetworkError'
  }
}

export class ProviderConflictError extends WalletError {
  constructor(conflictingProviders: string[]) {
    super(
      `Multiple providers detected: ${conflictingProviders.join(', ')}`,
      'PROVIDER_CONFLICT',
      undefined,
      'Multiple providers detected. Consider disabling wallet extensions you do not (want to) use.'
    );
    this.name = 'ProviderConflictError'
  }
}

export class WalletConnectionError extends WalletError {
  constructor(walletType: string, originalError?: any) {
    super(
      `Connection failed for ${walletType} wallet`,
      'CONNECTION_FAILED',
      walletType,
      `Failed to connect to ${walletType}. Please check your wallet and try again.`
    );
    this.name = 'WalletConnectionError';
  }
}

/**
 * CreateWalletError function creates error from provider error
 */
export function createWalletError(error: any, walletType: string): WalletError {
  if (error.code === 4001 || error.code === 'USER_REJECTION') {
    return new UserRejectedError(walletType);
  }

  if (error.message?.includes('connection') || error.code === 'CONNECTION_FAILED') {
    return new WalletConnectionError(walletType, error);
  }

  return new WalletError(error.message || 'Unknown wallet error', 'UNKNOWN_ERROR', walletType);
}
