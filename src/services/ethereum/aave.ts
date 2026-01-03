import { ethers } from "ethers";
import { AAVE_POOL_ADDRESSES, ETHEREUM_NETWORK_CONFIG, EthereumNetwork } from "./config";

// ABI for Aave V3 Pool.getReserveData
// function getReserveData(address asset) external view returns (DataTypes.ReserveData memory);
// struct ReserveData { configuration, liquidityIndex, currentLiquidityRate, variableBorrowIndex, currentVariableBorrowRate, currentStableBorrowRate, lastUpdateTimestamp, id, aTokenAddress, stableDebtTokenAddress, variableDebtTokenAddress, interestRateStrategyAddress, accruedToTreasury, unbacked, isolationModeTotalDebt }
// Index 2: currentLiquidityRate, Index 8: aTokenAddress
const POOL_ABI = [
  "function getReserveData(address asset) view returns (uint256, uint128, uint128, uint128, uint128, uint128, uint40, uint16, address, address, address, address, uint128, uint128, uint128)"
];

const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const SECONDS_PER_YEAR = 31536000n;

interface AaveData {
  apy: string;
  tvl: string;
}

/**
 * Helper function to format large numbers into a compact string (e.g., 1234567 -> $1.23M).
 * This is a simplified version and might not cover all edge cases or locales.
 */
function formatCompactNumber(num: number): string {
  if (num < 1000) {
    return `$${num.toFixed(2)}`;
  }
  const si = [
    { value: 1, symbol: "" },
    { value: 1E3, symbol: "K" },
    { value: 1E6, symbol: "M" },
    { value: 1E9, symbol: "B" },
    { value: 1E12, symbol: "T" },
  ];
  const rx = /\.0+$|(\.[0-9]*[1-9])0+$/;
  let i;
  for (i = si.length - 1; i > 0; i--) {
    if (num >= si[i].value) {
      break;
    }
  }
  return "$" + (num / si[i].value).toFixed(2).replace(rx, "$1") + si[i].symbol;
}

/**
 * Fetches the current supply APY and TVL for a given asset on Aave V3.
 * @param chainId The chain ID of the network (number or hex string).
 * @param tokenAddress The address of the asset (e.g., USDC).
 * @param provider An ethers.js Provider instance.
 * @returns Object containing formatted APY and TVL.
 */
export async function fetchAaveData(
  chainId: number | string,
  tokenAddress: string,
  provider: ethers.Provider
): Promise<AaveData> {
  try {
    // Normalize chainId to hex string for comparison with config
    const chainIdHex = typeof chainId === 'number'
      ? `0x${chainId.toString(16)}`
      : chainId;

    // Determine network from chainId
    const networkEntry = Object.entries(ETHEREUM_NETWORK_CONFIG).find(
      ([, config]) => config.chainId.toLowerCase() === chainIdHex.toLowerCase()
    );

    if (!networkEntry) {
      console.warn(`[fetchAaveData] Network not found for chainId: ${chainId}`);
      return { apy: "0%", tvl: "$0" };
    }

    const network = networkEntry[0] as EthereumNetwork;
    const poolAddress = AAVE_POOL_ADDRESSES[network]; // This config key now points to Pool addresses

    if (!poolAddress || poolAddress === "0x0000000000000000000000000000000000000000") {
      // console.warn(`[fetchAaveData] Pool address not configured for network: ${network}`);
      return { apy: "0%", tvl: "$0" };
    }

    const poolContract = new ethers.Contract(
      poolAddress,
      POOL_ABI,
      provider
    );

    // console.log(`[fetchAaveData] Fetching data for ${tokenAddress} on ${network} (Pool: ${poolAddress})`);

    // Fetch reserve data from Pool contract
    // Returns struct/tuple, index 2 is currentLiquidityRate, index 8 is aTokenAddress
    const reserveData = await poolContract.getReserveData(tokenAddress);
    
    // 1. Calculate APY
    const liquidityRate = reserveData[2] as bigint; // Index 2: currentLiquidityRate
    const depositAPR = Number(liquidityRate) / 1e27;
    const depositAPY = Math.pow(1 + (depositAPR / Number(SECONDS_PER_YEAR)), Number(SECONDS_PER_YEAR)) - 1;
    const formattedAPY = (depositAPY * 100).toFixed(2) + "%";

    // 2. Calculate TVL (from aToken totalSupply)
    // "no underlying token" -> Use aToken supply (Total Liquidity/Deposits)
    const aTokenAddress = reserveData[8] as string; // Index 8: aTokenAddress
    
    // Interact with the aToken contract directly
    const aTokenContract = new ethers.Contract(aTokenAddress, ERC20_ABI, provider);
    const totalSupply = await aTokenContract.totalSupply();
    
    // Assume 6 decimals for USDC/USDT 
    const formattedTVL = formatCompactNumber(Number(ethers.formatUnits(totalSupply, 6)));

    return { apy: formattedAPY, tvl: formattedTVL };

  } catch (error) {
    console.error(`[fetchAaveData] Error fetching data for ${tokenAddress}:`, error);
    return { apy: "Error", tvl: "Error" };
  }
}
