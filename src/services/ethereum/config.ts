

export enum EthereumNetwork {
  MAINNET = "mainnet",
  SEPOLIA = "sepolia",
  LOCALHOST = "localhost",
}

export const ETHEREUM_NETWORK_CONFIG = {
  [EthereumNetwork.LOCALHOST]: {
    chainId: "0x7A69", // 31337
    chainName: 'Localhost',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: ['http://127.0.0.1:8545'],
    blockExplorerUrls: []
  },
  [EthereumNetwork.SEPOLIA]: {
    chainId: "0xAA36A7", // 11155111
    chainName: 'Sepolia',
    nativeCurrency: {
      name: 'Sepolia ETH',
      symbol: 'SEP',
      decimals: 18
    },
    rpcUrls: ['https://rpc.sepolia.org'],
    blockExplorerUrls: ['https://sepolia.etherscan.io']
  },
  [EthereumNetwork.MAINNET]: {
    chainId: "0x1", // 1
    chainName: 'Ethereum Mainnet',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    rpcUrls: ['https://mainnet.infura.io/v3/'],
    blockExplorerUrls: ['https://etherscan.io']
  }
};

export const SUPPORTED_ASSETS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    icon: "/usdc-logo.png",
    decimals: 6,
    apy: "5.2%",
    tvl: "$12.5M",
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
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    icon: "/usdt-logo.png",
    decimals: 6,
    apy: "4.8%",
    tvl: "$8.2M",
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
