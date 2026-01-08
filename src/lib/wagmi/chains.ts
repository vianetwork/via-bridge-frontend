import { defineChain } from 'viem';
import { mainnet as viemMainnet, sepolia as viemSepolia } from "viem/chains";

export const ViaTestnet = defineChain({
  id: 25223, // 0x6287
  name: 'Via Network Sepolia',
  nativeCurrency: { name: 'BTC', symbol: 'BTC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://via.testnet.viablockchain.dev'] },
    public: { http: ['https://via.testnet.viablockchain.dev'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://testnet.blockscout.onvia.org' },
  },
  testnet: true,
});

export const ViaMainnet = defineChain({
  id: 5223,  // 0x1467
  name: 'Via Network',
  nativeCurrency: { name: 'BTC', symbol: 'BTC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://via.viablockchain.dev'] }, // TODO update if needed
    public: { http: ['https://via.viablockchain.dev'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://blockscout.onvia.org' },
  },
  testnet: false,
});

// Ethereum Sepolia - extend viem's build-in with custom RPC if needed
export const EthereumSepolia = defineChain({
  ...viemSepolia,
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/1uiSbDzdztbtMS63fthe6Hh_oYKUImtK'],
    }
  },
});

// Ethereum Mainnet - use viem's built-in chain directly
// Note: viemMainnet includes default public RPC URLs from Cloudflare, Ankr, etc.
export const EthereumMainnet = viemMainnet;
