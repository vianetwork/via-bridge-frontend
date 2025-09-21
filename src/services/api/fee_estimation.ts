import axios, {isAxiosError} from "axios";
import { API_BASE_URL } from "../config";

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
        const { data } = await axios.get<FeeEstimationResponse>(API_BASE_URL + "/fee-estimation", { params: { amount }, signal });
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