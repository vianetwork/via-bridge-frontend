// src/services/ethereum/withdraw.ts

import { VAULT_ABI } from "@/services/ethereum/abis";
import type { SupportedAsset } from "@/services/ethereum/config";
import { GetCurrentRoute } from "@/services/bridge/routes";
import { getEvmTxExplorerUrl } from "@/services/bridge/explorer";
import {ethers} from "ethers";

export interface ExecuteEthereumWithdrawParams {
  asset: SupportedAsset;
  amount: string;
  recipientEthereumAddress: string;
  isYield: boolean;
  signer: ethers.JsonRpcSigner;
}

export interface ExecuteEthereumWithdrawResult {
  txHash: string;
  l1ExplorerUrl: string | null;
}

/**
 * Executes an Ethereum withdrawal from VIA by calling the vault's withdraw method.
 *
 * @throws {Error} If the vault address is missing for the asset
 */
export async function executeEthereumWithdraw(params: ExecuteEthereumWithdrawParams): Promise<ExecuteEthereumWithdrawResult> {
  const { asset, amount, recipientEthereumAddress, isYield, signer } = params;

  const route = GetCurrentRoute("withdraw", "ethereum");

  const vaultAddress = isYield
    ? asset.vaultAddresses.ethereum.yieldBearing
    : asset.vaultAddresses.ethereum.standard;

  if (!vaultAddress) throw new Error("Missing vault address for this asset");

  const decimals = asset.decimals;
  const amountStr = parseFloat(amount).toFixed(decimals);
  const amountBN = ethers.parseUnits(amountStr, decimals);

  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, signer);
  const tx = await vault.withdraw(amountBN, recipientEthereumAddress);
  await tx.wait();

  return {
    txHash: tx.hash,
    l1ExplorerUrl: getEvmTxExplorerUrl(route.fromNetwork, tx.hash) || null,
  };
}
