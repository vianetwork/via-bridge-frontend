import { API_CONFIG } from "../config";
import { BitcoinNetwork } from "./types";
import { BRIDGE_CONFIG } from "@/services/config";
import axios from "axios";

/**
 * Fetches the balance of a Bitcoin address in satoshis
 */
export async function getBitcoinBalance(
  address: string,
  network: BitcoinNetwork = BRIDGE_CONFIG.defaultNetwork
): Promise<number> {
  for (const endpoint of [API_CONFIG.endpoints.bitcoin.primary, API_CONFIG.endpoints.bitcoin.fallback]) {
    const url = endpoint[network];
    try {
      const response = await axios.get(`${url}/address/${address}/utxo`);
      let balance = 0;
      for (const utxo of response.data) {
        balance += utxo.value;
      }
      return balance;
    } catch (error) {
      console.warn(`Failed to get balance from ${url},`, error);
      continue;
    }
  }
  return 0;
}