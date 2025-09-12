import axios from "axios";
import { API_BASE_URL } from "../config";
import { getUserIPAddress } from "../../utils/ip-address";

export interface FaucetResponse {
  success: boolean;
  error?: string;
  message?: string;
}

/**
 * Request funds from the VIA testnet faucet
 * @param address - The VIA network address to receive funds
 * @returns Promise<FaucetResponse>
 */
export async function requestFaucetFunds(
  address: string
): Promise<FaucetResponse> {
  try {
    const userIP = await getUserIPAddress();
    
    const response = await axios.post<FaucetResponse>(
      `${API_BASE_URL}/faucet/request-tokens?address=${address}`,
      {},
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': userIP,
        },
      }
    );
    console.log("Response:", response.data);

    return response.data;
  } catch (error) {
    console.error("Faucet request error:", error);
    
    if (axios.isAxiosError(error)) {
      if (error.response) {
        const errorMessage = error.response.data?.error || error.response.data?.message || 'Server error';
        return {
          success: false,
          error: errorMessage,
        };
      } else if (error.request) {
        return {
          success: false,
          error: 'Network error: Unable to reach faucet service',
        };
      }
    }
    
    // Generic error
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}
