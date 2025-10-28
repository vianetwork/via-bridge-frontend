import axios, {isAxiosError} from "axios";
import {BRIDGE_CONFIG, FEE_ESTIMATION_URL, VIA_NETWORK_CONFIG} from "../config";
import {Provider} from "via-ethers";

type FeeEstimationResponse = {
    success: boolean;
    data: number;
    message: string;
}

/**
 * Fetches a fee estimation based on the given amount.
 *
 * @param {number} amount - The amount for which the fee estimation is to be calculated. Must be a positive finite number.
 * @param {AbortSignal} [signal] - An optional AbortSignal to cancel the request if necessary.
 * @return {Promise<number>} A promise that resolves to the estimated fee as a number.
 * @throws {Error} Throws an error if the amount is invalid, the server response is unsuccessful, or the request fails.
 */
export async function fetchFeeEstimation(amount: number, signal?: AbortSignal): Promise<number> {
    if(!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid amount");
    let payload: FeeEstimationResponse;
    try {
        const { data } = await axios.get<FeeEstimationResponse>(FEE_ESTIMATION_URL, { params: { amount }, signal });
        payload = data;
    } catch (err) {
        if (isAxiosError(err) && err.code === "ERR_CANCELED") throw err;
        const msg = isAxiosError(err)
            ? err.response?.data?.message ?? err.message
            : (err as Error)?.message || "Failed to fetch fee estimation";
        throw new Error(msg || "Failed to fetch fee estimation");
    }

    const { success, data: fee, message } = payload;
    if (!success) throw new Error(message || "Failed to fetch fee estimation");
    if (!Number.isFinite(fee))  throw new Error("Invalid fee estimation from server");
    return fee;
 }

/**
 * Fetches an estimation of the deposit fee for a given amount.
 *
 * Note: Deposit gas usage does not depend on the numeric amount.
 * The 'amount' parameter is validated for API consistency but is not used in the fee calculation.
 * This estimates only the L2 execution cost (GAS_LIMIT * gasPrice) and then scales 18-decimal wei to an 8-decimal display unit.
 *
 * @param {number} amount - The deposit amount for which the fee estimation is needed. Must be a positive, finite number.
 * @param {AbortSignal} [_signal] - (Optional) AbortSignal to allow request cancellation.
 * @return {Promise<number>} A promise that resolves to the estimated deposit fee in 8-decimal units ("sats-like").
 * @throws {Error} Throws an error if the amount is invalid, fee calculation overflows, or if gas price retrieval fails.
 */
export async function fetchDepositFeeEstimation(amount: number, _signal?: AbortSignal): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("invalid amount");
  // Unused for now; reserved for future cancellation support
  void _signal;

  // https://github.com/vianetwork/via-core/blob/main/core/lib/types/src/l1/via_l1.rs#L14
  const GAS_LIMIT = 300_000n; // Fixed gas limit to required to execute deposit
  const MANTISSA = 10_000_000_000n;  // ETH 18 − BTC 8 = 10^10
  const MAX_FEE_PER_GAS_FALLBACK = 120_000_000n; // Deposit default L2 gas price

  const rpc = VIA_NETWORK_CONFIG[BRIDGE_CONFIG.defaultNetwork].rpcUrls[0];
  const provider = new Provider(rpc);

  try {
    const gasPrice = await provider.getGasPrice();
    const feeL2 = GAS_LIMIT * gasPrice; // wei
    const feeSats = (feeL2 + MANTISSA - 1n) / MANTISSA;
    const out = Number(feeSats);
    if (!Number.isSafeInteger(out)) throw new Error("Deposit fee overflow");
    return out;
  } catch (err) {
    // fallback to via-core default price if provider fails
    console.error("Failed to fetch gas price from provider, using fallback fee:", err);
    const feeL2 = GAS_LIMIT * MAX_FEE_PER_GAS_FALLBACK;
    const feeSats = (feeL2 + MANTISSA - 1n) / MANTISSA;
    const out = Number(feeSats);
    if (!Number.isSafeInteger(out)) {
      const msg = isAxiosError(err) ? (err.response?.data?.message ?? err.message) : (err as Error)?.message || "Failed to fetch fee estimation"; throw new Error(msg);
    }
    return out;
  }
}
