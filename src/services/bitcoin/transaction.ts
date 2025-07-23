"use client";

import axios from "axios";
import { type UTXO, type UserAddress, BitcoinNetwork, type DepositDetails } from "./types";
import * as btc from '@scure/btc-signer';
import { hex, base64 } from '@scure/base';
import { API_CONFIG, BRIDGE_CONFIG } from "@/services/config";

/**
 * Fetches current recommended fee rate in sats/vB
 * 
 * Returns default fee rate if both endpoints fail
 */
async function getFeeRate(
  network: BitcoinNetwork,
  targetBlocks: number = 3 // Target confirmation blocks
): Promise<number> {
  const axiosInstance = axios.create({
    timeout: API_CONFIG.timeout,
  });
  const apis = [
    API_CONFIG.endpoints.bitcoin.primary[network],
    API_CONFIG.endpoints.bitcoin.fallback[network]
  ];
  for (let i = 0; i < apis.length; i++) {
    try {
      // Try fallback endpoint (Mempool.space)
      console.log(`Fetching fee estimates from: ${apis[i]}`);
      const response = await axiosInstance.get(`${apis[i]}/v1/fees/recommended`);

      // Select fee rate based on target blocks:
      // fastestFee: ~1 block (10 minutes)
      // halfHourFee: ~3 blocks (30 minutes)
      // hourFee: ~6 blocks (1 hour)
      // economyFee: ~144 blocks (1 day)
      // minimumFee: lowest fee rate
      let feeRate: number;
      if (targetBlocks <= 1) {
        feeRate = response.data.fastestFee;
      } else if (targetBlocks <= 3) {
        feeRate = response.data.halfHourFee;
      } else if (targetBlocks <= 6) {
        feeRate = response.data.hourFee;
      } else {
        feeRate = response.data.economyFee;
      }

      console.log("Fee rate:", feeRate);

      if (typeof feeRate === 'number' && feeRate <= BRIDGE_CONFIG.maxPriorityFeeRate) {
        return feeRate;
      }
      console.warn(`Fallback endpoint fee rate ${feeRate} exceeds maximum ${BRIDGE_CONFIG.maxPriorityFeeRate} sats/vB`);
    } catch (backupError) {
      console.error("Both endpoints failed to get fee estimates", backupError);
    }
  }

  // If both endpoints fail or return excessive fees, use max priority fee rate
  console.log(`Using max priority fee rate ${BRIDGE_CONFIG.maxPriorityFeeRate} (sats/vB)`);
  return BRIDGE_CONFIG.maxPriorityFeeRate;
}

/**
 * Builds a transaction with UTXO selection
 */
export async function buildTransaction(
  inputs: UTXO[],
  userAddress: UserAddress,
  details: DepositDetails,
): Promise<{ psbtBase64: string; fee: bigint; inputCount: number }> {
  const btcNetwork = details.network === BitcoinNetwork.TESTNET ? btc.TEST_NETWORK : btc.NETWORK;
  const publicKeyBytes = hex.decode(userAddress.publicKey);
  const spend = btc.p2wpkh(publicKeyBytes, btcNetwork);

  // Convert UTXOs to btc-signer format
  const formattedInputs = inputs.map(utxo => ({
    ...spend,
    txid: hex.decode(utxo.txid),
    index: utxo.vout,
    witnessUtxo: {
      script: spend.script,
      amount: BigInt(utxo.value),
    },
  }));

  // Remove '0x' prefix if present
  const l2Address = details.l2ReceiverAddress.startsWith('0x')
    ? details.l2ReceiverAddress.slice(2)
    : details.l2ReceiverAddress;

  const outputs = [
    {
      address: details.bridgeAddress,
      amount: BigInt(details.satsAmount),
    },
    {
      script: btc.Script.encode(['RETURN', hex.decode(l2Address)]),
      amount: BigInt(0),
    },
  ];

  // Get current fee rate
  const feeRate = Math.round(await getFeeRate(details.network));
  console.log(`Fee rate used: ${feeRate} (sats/vB)`);

  // Select UTXOs and create transaction
  const selected = btc.selectUTXO(formattedInputs, outputs, 'default', {
    changeAddress: userAddress.address,
    // tx won't be broadcasted if it has a dust output, so we don't create change if it is below dust threshold and use this amount as additional fee
    alwaysChange: false,
    feePerByte: BigInt(feeRate),
    bip69: true,
    createTx: true,
    network: btcNetwork,
    allowUnknownOutputs: true,
  });

  console.log("Selected UTXOs: ", selected);

  if (!selected || !selected.tx) {
    throw new Error('UTXO selection failed');
  }

  const psbt = selected.tx.toPSBT(0);
  return {
    psbtBase64: base64.encode(psbt),
    fee: selected.fee ?? BigInt(BRIDGE_CONFIG.defaultFee),
    inputCount: selected.inputs.length,
  };
}

/**
 * Finalizes a transaction from a signed PSBT
 */
export async function finalizeTransaction(signedPsbt: string): Promise<string> {
  const psbtBinary = base64.decode(signedPsbt);
  const tx = btc.Transaction.fromPSBT(psbtBinary);
  tx.finalize();
  return hex.encode(tx.extract());
}

/**
 * Broadcasts a transaction to the Bitcoin network with fallback support
 */
export async function broadcastTransaction(
  rawTx: string,
  network: BitcoinNetwork = BRIDGE_CONFIG.defaultNetwork,
): Promise<string> {
  const axiosInstance = axios.create({
    timeout: API_CONFIG.timeout,
    headers: { "Content-Type": "text/plain" }
  });

  try {
    // Try primary endpoint first
    console.log("Broadcasting transaction via primary endpoint...");
    const primaryApi = API_CONFIG.endpoints.bitcoin.primary[network];
    const response = await axiosInstance.post(`${primaryApi}/tx`, rawTx);
    return response.data;
  } catch (error) {
    console.warn("Primary API endpoint failed for broadcast, trying fallback...", error);

    try {
      // Try fallback endpoint
      console.log("Broadcasting transaction via fallback endpoint...");
      const fallbackApi = API_CONFIG.endpoints.bitcoin.fallback[network];
      const response = await axiosInstance.post(`${fallbackApi}/tx`, rawTx);
      return response.data;
    } catch (backupError) {
      console.error("Both endpoints failed to broadcast transaction", backupError);
      throw new Error("Failed to broadcast transaction. Please try again later.");
    }
  }
}

/**
 * Gets a transaction explorer URL
 */
export function getTransactionExplorerUrl(txId: string, network: BitcoinNetwork = BRIDGE_CONFIG.defaultNetwork): string {
  return `${API_CONFIG.endpoints.bitcoin.explorer[network]}${txId}`;
}
