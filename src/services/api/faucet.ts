import axios from "axios";
import { API_BASE_URL } from "../config";

export interface FaucetResponse {
  success: boolean;
  error?: string;
  message?: string;
}

export interface FaucetRequestData {
  altchaToken: string;
}

/**
 * Request funds from the VIA testnet faucet
 * @param address - The VIA network address to receive funds
 * @returns Promise<FaucetResponse>
 */
export async function requestFaucetFunds(
  address: string,
): Promise<FaucetResponse> {
  try {
    const response = await axios.post<FaucetResponse>(
      `${API_BASE_URL}/faucet/request-tokens?address=${address}`,
      {},
      {
        timeout: 10000, // Reduced timeout for faster feedback
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '1.1.1.1',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error("Faucet request error:", error);
    
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // Server responded with error status
        const errorMessage = error.response.data?.error || error.response.data?.message || `Server error (${error.response.status})`;
        return {
          success: false,
          error: errorMessage,
        };
      } else if (error.request) {
        // Network error - server not reachable
        return {
          success: false,
          error: `Backend server not available. Please ensure the backend is running on ${API_BASE_URL}`,
        };
      } else if (error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: `Connection refused. Backend server is not running on ${API_BASE_URL}`,
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

export interface TransactionHashResponse {
  success: boolean;
  error?: string;
  data?: string;
}

export async function getTransactionHash(address: string): Promise<TransactionHashResponse> {
  try {
  const response = await axios.get<TransactionHashResponse>(
    `${API_BASE_URL}/faucet/get-transaction-hash?address=${address}`,
  );
    return response.data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred',
    };
  }
}
