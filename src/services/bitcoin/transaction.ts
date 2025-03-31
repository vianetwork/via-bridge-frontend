"use client";

import axios from "axios";
import { type UTXO, type UserAddress, BitcoinNetwork, type TransactionConfig } from "./types";
import { Transaction } from "@scure/btc-signer";
import { API_CONFIG, BRIDGE_CONFIG } from "@/services/config";

/**
 * Builds a Partial Signed Bitcoin Transaction (PSBT)
 */
export async function buildTransactionPSBT(
  utxo: UTXO,
  userAddress: UserAddress,
  config: TransactionConfig,
): Promise<string> {
  // Dynamically import browser-only libraries
  const { Transaction, p2wpkh, TEST_NETWORK, NETWORK } = await import("@scure/btc-signer");
  const { hex, base64 } = await import("@scure/base");

  const network = config.network === BitcoinNetwork.TESTNET ? TEST_NETWORK : NETWORK;
  const tx = new Transaction({ allowUnknownOutputs: true });
  const publicKeyBytes = hex.decode(userAddress.publicKey);
  const p2wpkhScript = p2wpkh(publicKeyBytes, network);

  // Add input (the coin we're spending)
  tx.addInput({
    txid: utxo.txid,
    index: utxo.vout,
    witnessUtxo: {
      script: p2wpkhScript.script,
      amount: BigInt(utxo.value),
    },
  });

  // Output 1: Send to VIA Bridge
  tx.addOutputAddress(config.bridgeAddress, BigInt(config.satsAmount), network);

  // Output 2: OP_RETURN with L2 receiver address
  await addOpReturnOutput(tx, config.l2ReceiverAddress);

  // Output 3: Change back to sender
  const change = utxo.value - config.satsAmount - config.satsFee;
  if (change > 0) {
    tx.addOutputAddress(userAddress.address, BigInt(change), network);
  }

  // Convert to PSBT and encode as base64
  const psbt = tx.toPSBT(0);
  return base64.encode(psbt);
}

/**
 * Helper to add OP_RETURN output with data
 */
async function addOpReturnOutput(tx: Transaction, data: string) {
  const { hex } = await import("@scure/base");

  const dataBytes = hex.decode(data);
  const pushByteLength = dataBytes.length;

  // Create OP_RETURN script: OP_RETURN + length + data
  const scriptBytes = new Uint8Array(2 + pushByteLength);
  scriptBytes[0] = 0x6a; // OP_RETURN
  scriptBytes[1] = pushByteLength; // Push length
  scriptBytes.set(dataBytes, 2);

  tx.addOutput({
    script: scriptBytes,
    amount: BigInt(0),
  });
}

/**
 * Finalizes a transaction from a signed PSBT
 */
export async function finalizeTransaction(signedPsbt: string): Promise<string> {
  const { Transaction } = await import("@scure/btc-signer");
  const { hex, base64 } = await import("@scure/base");

  const psbtBinary = base64.decode(signedPsbt);
  const tx = Transaction.fromPSBT(psbtBinary);
  tx.finalize();
  return hex.encode(tx.extract());
}

/**
 * Broadcasts a transaction to the Bitcoin network
 */
export async function broadcastTransaction(
  finalTxHex: string,
  network: BitcoinNetwork = BRIDGE_CONFIG.defaultNetwork,
): Promise<string> {
  const api = API_CONFIG.endpoints.bitcoin.primary[network];
  const response = await axios.post(`${api}/tx`, finalTxHex, { headers: { "Content-Type": "text/plain" } });
  return response.data; // Transaction ID
}

/**
 * Gets a transaction explorer URL
 */
export function getTransactionExplorerUrl(txId: string, network: BitcoinNetwork = BRIDGE_CONFIG.defaultNetwork): string {
  return `${API_CONFIG.endpoints.bitcoin.explorer[network]}${txId}`;
}
