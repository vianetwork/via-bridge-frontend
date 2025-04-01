"use client";

import axios, { type AxiosInstance } from "axios";
import { type UTXO, BitcoinNetwork } from "./types";
import { API_CONFIG, BRIDGE_CONFIG } from "@/services/config";

/**
 * Fetches the current block height
 */
async function getCurrentBlockHeight(
  network: BitcoinNetwork,
  axiosInstance: AxiosInstance
): Promise<number> {
  try {
    const response = await axiosInstance.get(`${API_CONFIG.endpoints.bitcoin.primary[network]}/blocks/tip/height`);
    return response.data;
  } catch (error) {
    console.warn("Failed to get block height from primary endpoint, trying fallback...", error);
    const response = await axiosInstance.get(`${API_CONFIG.endpoints.bitcoin.fallback[network]}/blocks/tip/height`);
    return response.data;
  }
}

/**
 * Fetches UTXOs for a given Bitcoin address and filters by minimum confirmations
 */
export async function getUTXOs(
  address: string, 
  network: BitcoinNetwork = BRIDGE_CONFIG.defaultNetwork,
  minConfirmations: number = BRIDGE_CONFIG.minBlockConfirmations
): Promise<UTXO[]> {
  const axiosInstance = axios.create({
    timeout: API_CONFIG.timeout,
  });

  try {
    // Get current block height first
    const currentBlockHeight = await getCurrentBlockHeight(network, axiosInstance);
    console.log("Current block height:", currentBlockHeight);

    // Then fetch UTXOs
    console.log("Fetching UTXOs from primary endpoint...");
    const response = await axiosInstance.get(`${API_CONFIG.endpoints.bitcoin.primary[network]}/address/${address}/utxo`);
    return filterConfirmedUTXOs(response.data, currentBlockHeight, minConfirmations);
  } catch (error) {
    console.warn("Primary API endpoint failed, trying fallback API endpoint...", error);
    
    try {
      // Try fallback endpoint
      const currentBlockHeight = await getCurrentBlockHeight(network, axiosInstance);
      const response = await axiosInstance.get(`${API_CONFIG.endpoints.bitcoin.fallback[network]}/address/${address}/utxo`);
      return filterConfirmedUTXOs(response.data, currentBlockHeight, minConfirmations);
    } catch (backupError) {
      console.error("Both endpoints failed", backupError);
      throw new Error("Failed to fetch UTXOs. Please try again later.");
    }
  }
}

/**
 * Filters UTXOs based on minimum confirmation count
 */
function filterConfirmedUTXOs(
  utxos: UTXO[], 
  currentBlockHeight: number,
  minConfirmations: number
): UTXO[] {
  const confirmedUtxos = utxos.filter(utxo => {
    if (!utxo.status?.confirmed || !utxo.status?.block_height) {
      return false;
    }
    
    const confirmations = currentBlockHeight - utxo.status.block_height + 1;
    return confirmations >= minConfirmations;
  });
  
  if (confirmedUtxos.length === 0) {
    throw new Error(
      `No UTXOs found with at least ${minConfirmations} confirmations. ` +
      "Please wait for your transactions to be confirmed."
    );
  }

  return confirmedUtxos;
}
