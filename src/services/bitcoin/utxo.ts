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
  for (const endpoint of [API_CONFIG.endpoints.bitcoin.primary, API_CONFIG.endpoints.bitcoin.fallback]) {
    const url = endpoint[network];
    try {
      const response = await axiosInstance.get(`${url}/blocks/tip/height`);
      return response.data;
    } catch (error) {
      console.warn(`Failed to get block height from ${url},`, error);
      continue;
    }
  }
  throw new Error("Failed to get block height from both endpoints");
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
  const currentBlockHeight = await getCurrentBlockHeight(network, axiosInstance);

  for (const endpoint of [API_CONFIG.endpoints.bitcoin.primary, API_CONFIG.endpoints.bitcoin.fallback]) {
    const url = endpoint[network];
    try {
      const response = await axiosInstance.get(`${url}/address/${address}/utxo`);
      return filterConfirmedUTXOs(response.data, currentBlockHeight, minConfirmations);;
    } catch (error) {
      console.warn(`Failed to get UTXOs from ${url},`, error);
      continue;
    }
  }

  throw new Error("Failed to get wallet UTXOs");
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

export function checkIfEnoughBalance(
  availableUtxos: UTXO[],
  requiredAmount: number,
  minConfirmations: number = BRIDGE_CONFIG.minBlockConfirmations
) {
  const totalAvailableBalance = availableUtxos.reduce((sum, { value }) => sum + value, 0);
  if (totalAvailableBalance < requiredAmount) {
    throw new Error(
      `Insufficient balance to deposit. UTXOs must have at least ${minConfirmations} confirmations to be eligible for deposit into the VIA network.`
    );
  }
}