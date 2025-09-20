export const L1_BTC_DECIMALS = 8;
export const L2_BTC_DECIMALS = 18;
export const SYSTEM_CONTRACTS_ADDRESSES_RANGE = "0x000000000000000000000000000000000000ffff";

// BTC domain constants
export const SATS_PER_BTC = 10 ** L1_BTC_DECIMALS;  // 100_000_000

// Deposit minimums and fee reserves
export const MIN_DEPOSIT_SATS = 20_000; // 0.0002 BTC
export const FEE_RESERVE_SATS = 10_000; // 0.0001 BTC
export const MIN_DEPOSIT_BTC = MIN_DEPOSIT_SATS / SATS_PER_BTC; // 0.0002 BTC
export const FEE_RESERVE_BTC = FEE_RESERVE_SATS / SATS_PER_BTC;  // 0.0001 BTC

// Withdraw minimums
export const MIN_WITHDRAW_SATS = 2_000; // 0.00002 BTC
export const MIN_WITHDRAW_BTC = MIN_WITHDRAW_SATS / SATS_PER_BTC;
