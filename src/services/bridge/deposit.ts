"use client";

import { getUTXOs } from "../bitcoin/utxo";
import { buildTransaction, broadcastTransaction, finalizeTransaction } from "../bitcoin/transaction";
import { type UserAddress, BitcoinNetwork } from "../bitcoin/types";
import { BRIDGE_CONFIG } from "@/services/config";
import { getTransactionExplorerUrl } from "../bitcoin/transaction";
import { L1_BTC_DECIMALS } from "../constants";

// Interface for deposit parameters
export interface DepositParams {
  bitcoinAddress: string
  bitcoinPublicKey: string
  recipientViaAddress: string
  amountInBtc: number
  network?: BitcoinNetwork
}

// Interface for deposit result
export interface DepositResult {
  txId: string
  explorerUrl: string
}

/**
 * Executes a deposit from Bitcoin to VIA
 */
export async function executeDeposit(params: DepositParams): Promise<DepositResult> {
  const { signTransaction, BitcoinNetworkType } = await import("sats-connect");

  const network = params.network || BRIDGE_CONFIG.defaultNetwork;
  const bridgeAddress = BRIDGE_CONFIG.addresses[network];
  const satsAmount = Math.floor(params.amountInBtc * 10 ** L1_BTC_DECIMALS);

  const utxos = await getUTXOs(params.bitcoinAddress, network);

  if (utxos.length === 0) {
    throw new Error("No UTXOs found. Please fund your wallet with Bitcoin");
  }

  // Build transaction with automatic UTXO selection
  const userAddress: UserAddress = {
    address: params.bitcoinAddress,
    publicKey: params.bitcoinPublicKey,
    purpose: "payment",
  };

  const { psbtBase64, fee, inputCount } = await buildTransaction(utxos, userAddress, {
    bridgeAddress,
    l2ReceiverAddress: params.recipientViaAddress,
    satsAmount,
    network,
  });
  console.log("Estimated fee", fee.toString(), ", Number of inputs:", inputCount);

  const bitcoinNetworkType =
    network === BitcoinNetwork.TESTNET ? BitcoinNetworkType.Testnet : BitcoinNetworkType.Mainnet;

  // Request signature from Xverse wallet
  const signedTxResponse = await new Promise<any>((resolve, reject) => {
    signTransaction({
      payload: {
        network: { type: bitcoinNetworkType },
        message: "Sign VIA deposit transaction",
        psbtBase64,
        inputsToSign: [{ 
          address: params.bitcoinAddress, 
          signingIndexes: Array.from({ length: inputCount }, (_, i) => i), // Sign all inputs
        }],
        broadcast: false,
      },
      onFinish: resolve,
      onCancel: () => reject(new Error("Transaction signing cancelled")),
    });
  });

  // Finalize and broadcast
  const rawTx = await finalizeTransaction(signedTxResponse.psbtBase64);
  console.log("Final raw transaction: ", rawTx);
  const txId = await broadcastTransaction(rawTx, network);

  return {
    txId,
    explorerUrl: getTransactionExplorerUrl(txId, network),
  };
}
