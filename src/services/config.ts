import { BitcoinNetwork } from "@/services/bitcoin/types";
import { env } from "@/lib/env";

export enum Layer {
  L1,
  L2,
};

// Todo: updaye RPC and the chainId
export const VIA_NETWORK_CONFIG = {
  [BitcoinNetwork.TESTNET]: {
    chainId: "0x6287",
    chainName: 'VIA Network',
    nativeCurrency: {
      name: 'BTC',
      symbol: 'BTC',
      decimals: 18
    },
    rpcUrls: ['https://via.testnet.viablockchain.dev'],
    blockExplorerUrls: ['']

  },
  [BitcoinNetwork.MAINNET]: {
    chainId: "0x1467",
    chainName: 'VIA Network',
    nativeCurrency: {
      name: 'BTC',
      symbol: 'BTC',
      decimals: 18
    },
    rpcUrls: ['http://localhost:3050'],
    blockExplorerUrls: ['http://localhost:3050']
  }
};

export const getNetworkConfig = () => {
  return VIA_NETWORK_CONFIG[env().NEXT_PUBLIC_NETWORK];
};

export const API_CONFIG = {
  timeout: 30000, // 5 seconds timeout
  endpoints: {
    bitcoin: {
      primary: {
        [BitcoinNetwork.TESTNET]: "https://mempool.space/testnet/api",
        [BitcoinNetwork.MAINNET]: "https://blockstream.info/api",
      },
      fallback: {
        [BitcoinNetwork.TESTNET]: "https://blockstream.info/testnet/api",
        [BitcoinNetwork.MAINNET]: "https://mempool.space/api",
      },
      explorer: {
        [BitcoinNetwork.TESTNET]: "https://mempool.space/testnet/tx/",
        [BitcoinNetwork.MAINNET]: "https://mempool.space/tx/",
      },
    },
  },
} as const;

export const BRIDGE_CONFIG = {
  // TODO: Add real bridge addresses
  addresses: {
    [BitcoinNetwork.TESTNET]: "tb1ppsy8j80jtns42rkpdsfcv25qfschqejxmk6datkvu236eekr4fms06wnz0",
    [BitcoinNetwork.MAINNET]: "",
  },
  maxPriorityFeeRate: 10, // Maximum acceptable fee rate in sats/vB
  defaultFee: 400, // Default fee in satoshis
  minBlockConfirmations: 3, // Minimum number of block confirmations required
  defaultNetwork: env().NEXT_PUBLIC_NETWORK,
  viaChainId: VIA_NETWORK_CONFIG[env().NEXT_PUBLIC_NETWORK].chainId,
} as const; 