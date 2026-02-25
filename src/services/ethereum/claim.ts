// src/services/ethereum/claim.ts
import { ethers } from "ethers";
import { BRIDGE_ABI} from "@/services/ethereum/abis";

export interface ExecuteEthereumClaims {
  l1VaultAddress: string;
  nonce: string;
  shares: string;
  l1Receiver: string;
  signer: ethers.JsonRpcSigner;
}

export interface ExecuteEthereumClaimResult {
  txHash: string;
}

/**
 * Claims a pending withdrawal on Ethereum L1 after the withdrawal has been finalized.
 *
 * @throws {Error} If the vault or receiver address is invalid
 * @throws {Error} If nonce or shares are invalid
 */
export async function executeEthereumClaim(params: ExecuteEthereumClaims): Promise<ExecuteEthereumClaimResult> {
  const { l1VaultAddress, nonce, shares, l1Receiver, signer } = params;

  if (!ethers.isAddress(l1VaultAddress)) throw new Error("Invalid L1 vault address");
  if(!ethers.isAddress(l1Receiver)) throw new Error("Invalid receiver address");

  const nonceBn = BigInt(nonce);
  const sharesBn = BigInt(shares);

  if (nonceBn < 0n || sharesBn <= 0n) throw new Error("Invalid nonce or shares");

  const vault = new ethers.Contract(l1VaultAddress, BRIDGE_ABI, signer);

  const tx = await vault.claimWithdrawal(nonceBn, sharesBn, l1Receiver);
  await tx.wait();

  return { txHash: tx.hash,};
}
