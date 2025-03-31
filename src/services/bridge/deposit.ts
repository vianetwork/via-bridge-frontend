"use client";

import { getUTXOs, selectUTXO } from "../bitcoin/utxo";
import { buildTransactionPSBT, broadcastTransaction, finalizeTransaction } from "../bitcoin/transaction";
import { type UserAddress, BitcoinNetwork } from "../bitcoin/types";
import { BRIDGE_CONFIG } from "@/services/config";
import { getTransactionExplorerUrl } from "../bitcoin/transaction";
import { SATS_PER_BTC } from "../constants";

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
  // Dynamically import sats-connect
  const { signTransaction, BitcoinNetworkType } = await import("sats-connect");

  const network = params.network || BRIDGE_CONFIG.defaultNetwork;
  const bridgeAddress = BRIDGE_CONFIG.addresses[network];
  const satsFee = BRIDGE_CONFIG.defaultFee;

  // Convert BTC to satoshis
  const satsAmount = params.amountInBtc * SATS_PER_BTC;

  // Step 1: Get UTXOs from the user's address
  const utxos = await getUTXOs(params.bitcoinAddress, network);
  console.log("UTXOs", utxos);

  if (utxos.length === 0) {
    throw new Error("No UTXOs found. Please fund your wallet with Bitcoin");
  }

  // Step 2: Select an appropriate UTXO
  const selectedUtxo = selectUTXO(utxos, satsAmount + satsFee);
  console.log("Selected UTXO", selectedUtxo);
  if (!selectedUtxo) {
    throw new Error(
      `No UTXO with sufficient funds found. Need at least ${(satsAmount + satsFee) / SATS_PER_BTC} BTC`,
    );
  }

  // Step 3: Build the transaction PSBT
  const userAddress: UserAddress = {
    address: params.bitcoinAddress,
    publicKey: params.bitcoinPublicKey,
    purpose: "payment",
  };

  const base64Psbt = await buildTransactionPSBT(selectedUtxo, userAddress, {
    bridgeAddress,
    l2ReceiverAddress: params.recipientViaAddress,
    satsAmount,
    satsFee,
    network,
  });
  console.log("Base64 PSBT", base64Psbt);

  // Step 4: Request signature from wallet
  const bitcoinNetworkType =
    network === BitcoinNetwork.TESTNET ? BitcoinNetworkType.Testnet : BitcoinNetworkType.Mainnet;

  const signedTxResponse = await new Promise<any>((resolve, reject) => {
    signTransaction({
      payload: {
        network: { type: bitcoinNetworkType },
        message: "Sign VIA deposit transaction",
        psbtBase64: base64Psbt,
        inputsToSign: [{ address: params.bitcoinAddress, signingIndexes: [0] }],
        broadcast: false,
      },
      onFinish: resolve,
      onCancel: () => reject(new Error("Transaction signing cancelled")),
    });
  });

  // Step 5: Finalize the transaction
  const finalTxHex = await finalizeTransaction(signedTxResponse.psbtBase64);
  console.log("Final TX Hex", finalTxHex);

  // Step 6: Broadcast the transaction
  const txId = await broadcastTransaction(finalTxHex, network);

  return {
    txId,
    explorerUrl: getTransactionExplorerUrl(txId, network),
  };
}
