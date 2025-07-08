import axios from "axios";
import { API_BASE_URL } from "../config";
import { sleep } from "via-ethers/build/utils";

interface FeeEstimationResponse {
    success: boolean;
    data: number
    message: string;
}

// Function to fetch user transactions
export async function fetchFeeEstimation(
    amount: number,
): Promise<FeeEstimationResponse["data"]> {
    while (true) {
        try {
            const response = await axios.get<FeeEstimationResponse>(
                `${API_BASE_URL}/fee-estimation`,
                {
                    params: {
                        amount
                    },
                }
            );

            if (!response.data.success) {
                throw new Error(response.data.message || "Failed to fetch fee estimation");
            }

            return response.data.data;
        } catch (error) {
            console.error("Error fetching fee estimation:", error);
            await sleep(3000)
        }
    }
}
