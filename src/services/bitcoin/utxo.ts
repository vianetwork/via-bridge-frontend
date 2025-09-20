"use client";

import axios  from "axios";
import { type UTXO, BitcoinNetwork } from "./types";
import { API_CONFIG, BRIDGE_CONFIG } from "@/services/config";

/**
 * Fetches UTXOs for a given Bitcoin address and filters by minimum confirmations
 */
export async function getUTXOs(
  address: string,
  network: BitcoinNetwork = BRIDGE_CONFIG.defaultNetwork
): Promise<UTXO[]> {
  const axiosInstance = axios.create({
    timeout: API_CONFIG.timeout,
  });

  for (const endpoint of [API_CONFIG.endpoints.bitcoin.primary, API_CONFIG.endpoints.bitcoin.fallback]) {
    const url = endpoint[network];
    try {
      const response = await axiosInstance.get(`${url}/address/${address}/utxo`);
      return response.data;
    } catch (error) {
      // If it's the specific "no confirmed UTXOs" validation, rethrow as-is for the UI to handle
      if (error instanceof Error && error.message.includes("No UTXOs found with at least")) {
        throw error;
      }
      console.warn(`Failed to get UTXOs from ${url},`, error);
      continue;
    }
  }

  throw new Error("Failed to get wallet UTXOs");
}

export function checkIfEnoughBalance(
  availableUtxos: UTXO[],
  requiredAmount: number
) {
  const totalAvailableBalance = availableUtxos.reduce((sum, { value }) => sum + value, 0);
  if (totalAvailableBalance < requiredAmount) {
    throw new Error(
      `Insufficient balance to deposit. Available balance: ${totalAvailableBalance} sats, required: ${requiredAmount} sats.`
    );
  }
}