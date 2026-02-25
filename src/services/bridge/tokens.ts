import { TokenInfo } from '@/services/bridge/types';

/**
 * All supported bridge tokens
 * 
 * Registry of tokens that can be bridged between networks.
 * Each token contains metadata including symbol, name, decimals, and icon.
 * 
 * **Available Tokens: **
 * - `BTC` - Bitcoin (8 decimals)
 * 
 *
 * @example
 * ```typescript
 * // Access token metadata
 * const btc = TOKENS.BTC;
 * console.log(btc.symbol); // "BTC"
 * console.log(btc.decimals); // 8
 * ```
 * 
 * @example
 * ```typescript
 * // Use in amount formatting
 * const amount = 0.00123456;
 * const formatted = amount.toFixed(TOKENS.BTC.decimals);
 * console.log(formatted); // "0.00123456"
 * ```
 * 
 * @see {@link TokenInfo} for the token type definition
 */
export const TOKENS: Record<string, TokenInfo> = {
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    decimals: 8,
    icon: '/bitcoin-logo.svg',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    icon: '/usdc-logo.png',
    contractAddress: '0x...', // Contract addresses are network-specific and stored in routes or ethereum/config.ts but it should be here
  },
  // TODO uncomment when USDT is available on Via
  // USDT: {
  //   symbol: 'USDT',
  //   name: 'Tether USD',
  //   decimals: 6,
  //   icon: '/usdt-logo.png',
  // }
};
