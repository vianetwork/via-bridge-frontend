// srs/services/ethereum/deposit.ts
import { ethers } from 'ethers';
import {ERC20_ABI, VAULT_ABI} from "@/services/ethereum/abis";
import {
  getAssetAddress,
  type SupportedAsset,
} from "@/services/ethereum/config";
import { GetCurrentRoute } from "@/services/bridge/routes";
import { getEvmTxExplorerUrl } from "@/services/bridge/explorer";
import { abortablePromise } from "@/utils/promise";

/** Input payload for an Ethereum to VIA deposit. */
export interface ExecuteEthereumDepositParams {
  asset: SupportedAsset;
  amount: string;
  recipientViaAddress: string;
  isYield: boolean;
  signer: ethers.JsonRpcSigner;
  signal?: AbortSignal;
}

/** Minimal response for tracking the deposit on L1. */
export interface ExecuteEthereumDepositResponse {
  txHash: string;
  l1ExplorerUrl: string | null;
}

/**
 * Executes an Ethereum deposit by transferring the specified asset to a vault
 * and bridging it to a recipient address on VIA.
 *
 * Handles token approval, vault deposit, and returns transaction metadata.
 *
 * @throws {Error} If the asset is unsupported (missing token or vault address)
 */
export async function executeEthereumDeposit(params: ExecuteEthereumDepositParams): Promise<ExecuteEthereumDepositResponse> {
  const { asset, amount, recipientViaAddress, isYield, signer, signal } = params;

  const route = GetCurrentRoute("deposit", "ethereum");

  const tokenAddress = getAssetAddress(asset);
  
  const vaultAddress = isYield
    ? asset.vaultAddresses.ethereum.yieldBearing
    : asset.vaultAddresses.ethereum.standard;

  if (!tokenAddress || !vaultAddress) throw new Error("Missing token or vault address for this asset");

  const decimals = asset.decimals;
  // Normalize user input to token decimals before converting to units.
  const amountStr = parseFloat(amount).toFixed(decimals);
  const amountBN = ethers.parseUnits(amountStr, decimals);

  const tokenRead = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const userAddress = await signer.getAddress();
  const allowance = await tokenRead.allowance(userAddress, vaultAddress);

  // Approve only when the current allowance is insufficient.
  if (allowance < amountBN) {
    const approveTx = await abortablePromise(tokenRead.approve(vaultAddress, amountBN), signal);
    await abortablePromise(approveTx.wait(), signal);
  }

  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, signer);
  const tx = await abortablePromise(vault.depositWithBridge(amountBN, recipientViaAddress), signal);
  await abortablePromise(tx.wait(), signal);

  return {
    txHash: tx.hash,
    l1ExplorerUrl: getEvmTxExplorerUrl(route.fromNetwork, tx.hash) || null,
  };
}
