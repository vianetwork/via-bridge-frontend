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
    rpcUrls: ['http://via.testnet.viablockchain.dev'],
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

export const API_CONFIG = {
  timeout: 5000, // 5 seconds timeout
  endpoints: {
    bitcoin: {
      primary: {
        [BitcoinNetwork.TESTNET]: "https://blockstream.info/testnet/api",
        [BitcoinNetwork.MAINNET]: "https://blockstream.info/api",
      },
      fallback: {
        [BitcoinNetwork.TESTNET]: "https://mempool.space/testnet/api",
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
    [BitcoinNetwork.TESTNET]: "tb1p5883ewsczarkj0zpeuucgqxsc63sschq4mdkg2swwd3a9mc67dfqwc4pg9",
    [BitcoinNetwork.MAINNET]: "",
  },
  maxPriorityFeeRate: 10, // Maximum acceptable fee rate in sats/vB
  defaultFee: 400, // Default fee in satoshis
  minBlockConfirmations: 3, // Minimum number of block confirmations required
  defaultNetwork: env().NEXT_PUBLIC_NETWORK,
  viaChainId: VIA_NETWORK_CONFIG[env().NEXT_PUBLIC_NETWORK].chainId,
} as const; 