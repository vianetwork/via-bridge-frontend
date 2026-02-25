import { createConfig, http, type Config } from 'wagmi';
import { BRIDGE_CONFIG } from '@/services/config';
import { BitcoinNetwork } from '@/services/bitcoin/types';
import { ViaTestnet, ViaMainnet, EthereumSepolia, EthereumMainnet } from '@/lib/wagmi/chains';


// Use exactly one chain based on app configuration
const isMainnet = BRIDGE_CONFIG.defaultNetwork === BitcoinNetwork.MAINNET;

// Build config in two branches to satisfy wagmi v2 generics.
// Each branch provides a readonly tuple of chains and transport for that exact chain id.
export const wagmiConfig: Config = isMainnet
  ? createConfig({
      chains: [ViaMainnet, EthereumMainnet] as const,
      transports: {
        [ViaMainnet.id]: http(),
        [EthereumMainnet.id]: http(),
      },
      connectors: [], // construct targeted injected connectors at connect time
      multiInjectedProviderDiscovery: false, // we manage providers via EIP-6963 + targeted connectors
    })
  : createConfig({
      chains: [ViaTestnet, EthereumSepolia] as const,
      transports: {
        [ViaTestnet.id]: http(),
        [EthereumSepolia.id]: http(),
      },
      connectors: [], // construct targeted injected connectors at connect time
      multiInjectedProviderDiscovery: false, // we manage providers via EIP-6963 + targeted connectors
    });
