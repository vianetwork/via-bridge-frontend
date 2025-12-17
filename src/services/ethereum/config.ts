


export enum EthereumNetwork {
  SEPOLIA = "sepolia",
}

export const ETHEREUM_NETWORK_CONFIG = {
  [EthereumNetwork.SEPOLIA]: {
    chainId: "0xAA36A7", // 11155111
    chainName: 'Sepolia',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'SEP',
      decimals: 18
    },
    rpcUrls: [process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/1uiSbDzdztbtMS63fthe6Hh_oYKUImtK'],
    blockExplorerUrls: ['https://sepolia.etherscan.io']
  }
};

// Aave V3 "Pool" Contract Addresses
export const AAVE_POOL_ADDRESSES = {
  [EthereumNetwork.SEPOLIA]: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
};

export const SUPPORTED_ASSETS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    icon: "/usdc-logo.png",
    decimals: 6,
    active: true,
    apy: "Not available",
    tvl: "Not available",
    addresses: {
      [EthereumNetwork.SEPOLIA]: "0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8", // Custom Sepolia USDC
    },
    vaults: {
      l1: {
        normal: "0xDfA2De059b80DD48c6f51E1ee791241f144a7F54", 
        yield: "0x15Cc81D136277b5D38f75151dD5D0DB0571526Fc",
      },
      l2: {
        normal: "0x59bc242EBB43e05707B05fBE04682C6E35EfB056", 
        yield: "0x327d741E500E11Ab69F9D1A496A0ab4F934fA463",
      }
    }
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    icon: "/usdt-logo.png",
    decimals: 6,
    active: false,
    apy: "4.8%", // Default fallback
    tvl: "$8.2M",
    addresses: {
      [EthereumNetwork.SEPOLIA]: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0", // Standard Sepolia USDT
    },
    vaults: {
      l1: {
        normal: "0x...", // TODO: Add real address
        yield: "0x...", // TODO: Add real address
      },
      l2: {
        normal: "0x...", // TODO: Add real address
        yield: "0x...", // TODO: Add real address
      }
    }
  }
];

