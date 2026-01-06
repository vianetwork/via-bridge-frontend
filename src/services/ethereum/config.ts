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

// Multicall contract addresses
export const MULTICALL_ADDRESSES = {
  [EthereumNetwork.SEPOLIA]: "0xD7F33bCdb21b359c8ee6F0251d30E94832baAd07"
};

// Aave V3 "Pool" Contract Addresses
export const AAVE_POOL_ADDRESSES = {
  [EthereumNetwork.SEPOLIA]: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
};

/** Vault addresses for a supported asset on each network */
export interface AssetVaultAddresses {
  /** Vault addresses on Ethereum L1 (Sepolia for testnet) */
  ethereum: {
    /** Standard vault without yield generation */
    standard: string;
    /** Yield-bearing vault (Aave integration) */
    yieldBearing: string;
  };
  /** Vault addresses on VIA Network L2 */
  via: {
    /** Standard vault without yield generation */
    standard: string;
    /** Yield-bearing vault (Aave integration) */
    yieldBearing: string;
  };
}

/** Supported asset configuration */
export interface SupportedAsset {
  symbol: string;
  name: string;
  l2ValueSymbol: string;
  icon: string;
  decimals: number;
  minAmount: string;
  active: boolean;
  apy: string;
  tvl: string;
  addresses: Record<EthereumNetwork, string>;
  vaultAddresses: AssetVaultAddresses;
}

export const SUPPORTED_ASSETS: SupportedAsset[] = [
  {
    symbol: "USDC",
    name: "USD Coin",
    l2ValueSymbol: "vUSDC", // L2 yield token symbol
    icon: "/usdc-logo.png",
    decimals: 6,
    minAmount: "0.000001", // Minimum amount to deposit/withdraw (0.000001 USDC)
    active: true,
    apy: "Not available",
    tvl: "Not available",
    addresses: {
      [EthereumNetwork.SEPOLIA]: "0x94a9d9ac8a22534e3faca9f4e7f2e2cf85d5e4c8", // Custom Sepolia USDC
    },
    vaultAddresses: {
      ethereum: {
        standard: "0xDfA2De059b80DD48c6f51E1ee791241f144a7F54", 
        yieldBearing: "0x15Cc81D136277b5D38f75151dD5D0DB0571526Fc",
      },
      via: {
        standard: "0x59bc242EBB43e05707B05fBE04682C6E35EfB056", 
        yieldBearing: "0x327d741E500E11Ab69F9D1A496A0ab4F934fA463",
      }
    }
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    l2ValueSymbol: "vUSDT", // L2 yield token symbol
    icon: "/usdt-logo.png",
    decimals: 6,
    minAmount: "0.000001", // Minimum amount to deposit/withdraw (0.000001 USDT)
    active: false,
    apy: "4.8%", // Default fallback
    tvl: "$8.2M",
    addresses: {
      [EthereumNetwork.SEPOLIA]: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0", // Standard Sepolia USDT
    },
    vaultAddresses: {
      ethereum: {
        standard: "0x...", // TODO: Add real address
        yieldBearing: "0x...", // TODO: Add real address
      },
      via: {
        standard: "0x...", // TODO: Add real address
        yieldBearing: "0x...", // TODO: Add real address
      }
    }
  }
];
