// src/services/bridge/explorer.ts
import type { NetworkInfo } from '@/services/bridge/types';

export function getEvmTxExplorerUrl(network: NetworkInfo, txHash: string): string | null {
  if (network.type !== 'evm') return null;
  if (!network.blockExplorerUrl) return null;
  if (!txHash) return null;

  // Ensure base ends with '/' so URL joins correctly.
  const base = network.blockExplorerUrl.endsWith('/')
    ? network.blockExplorerUrl
    : `${network.blockExplorerUrl}/`;

  return new URL(`tx/${txHash}`, base).toString();
}
