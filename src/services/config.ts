import { BitcoinNetwork } from "@/services/bitcoin/types";
import { env } from "@/lib/env";


// Define the API base URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://0.0.0.0:5050";

export enum Layer {
  L1,
  L2,
};

// Todo: updaye RPC and the chainId
export const VIA_NETWORK_CONFIG = {
  [BitcoinNetwork.REGTEST]: {
    chainId: "0x6287",
    chainName: 'VIA Network',
    nativeCurrency: {
      name: 'BTC',
      symbol: 'BTC',
      decimals: 18
    },
    rpcUrls: ['http://0.0.0.0:3050'],
    blockExplorerUrls: ['http://0.0.0.0:4000']
  },
  [BitcoinNetwork.TESTNET]: {
    chainId: "0x6287",
    chainName: 'VIA Network',
    nativeCurrency: {
      name: 'BTC',
      symbol: 'BTC',
      decimals: 18
    },
    rpcUrls: ['https://via.testnet.viablockchain.dev'],
    blockExplorerUrls: ['https://testnet.blockscout.onvia.org']
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
    blockExplorerUrls: ['http://0.0.0.0:4000']
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
        [BitcoinNetwork.TESTNET]: "https://mempool.space/testnet4/api",
        [BitcoinNetwork.MAINNET]: "https://mempool.space/api",
        [BitcoinNetwork.REGTEST]: "https://mempool.space/testnet4/api",
      },
      fallback: {
        [BitcoinNetwork.TESTNET]: "https://mempool.space/testnet4/api",
        [BitcoinNetwork.MAINNET]: "https://mempool.space/api",
        [BitcoinNetwork.REGTEST]: "https://blockstream.info/testnet/api",
      },
      explorer: {
        [BitcoinNetwork.TESTNET]: "https://mempool.space/testnet4/tx/",
        [BitcoinNetwork.MAINNET]: "https://mempool.space/tx/",
        [BitcoinNetwork.REGTEST]: "http://localhost:1880/tx/",
      },
    },
  },
} as const;

export const BRIDGE_CONFIG = {
  // TODO: Add real bridge addresses
  addresses: {
    [BitcoinNetwork.REGTEST]: "bcrt1p3s7m76wp5seprjy4gdxuxrr8pjgd47q5s8lu9vefxmp0my2p4t9qh6s8kq",
    [BitcoinNetwork.TESTNET]: "tb1ppsy8j80jtns42rkpdsfcv25qfschqejxmk6datkvu236eekr4fms06wnz0",
    [BitcoinNetwork.MAINNET]: "",
  },
  maxPriorityFeeRate: 5, // Maximum acceptable fee rate in sats/vB
  defaultFee: 400, // Default fee in satoshis
  minBlockConfirmations: 3, // Minimum number of block confirmations required
  defaultNetwork: env().NEXT_PUBLIC_NETWORK,
  viaChainId: VIA_NETWORK_CONFIG[env().NEXT_PUBLIC_NETWORK].chainId,
} as const; 