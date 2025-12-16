import { ethers } from "ethers";

/**
 * Computes the payload hash for a withdrawal message
 * This matches the contract's payload creation:
 * bytes memory payload = abi.encode(
 *     vaultNonce,
 *     uint8(2),
 *     pair.l1Vault,
 *     receiver,
 *     shares
 * );
 * bytes32 payloadHash = keccak256(payload);
 * 
 * @param vaultNonce - The vault nonce (withdrawal nonce)
 * @param l1Vault - The L1 vault address
 * @param receiver - The receiver address (L1 recipient)
 * @param shares - The shares amount (as string or bigint)
 * @returns The keccak256 hash of the encoded payload
 */
export function computeWithdrawalPayloadHash(
  vaultNonce: string | bigint,
  l1Vault: string,
  receiver: string,
  shares: string | bigint
): string {
  // Convert inputs to appropriate types
  const nonce = typeof vaultNonce === 'string' ? BigInt(vaultNonce) : vaultNonce;
  const messageType = 2; // uint8(2) - withdrawal message type
  const sharesBigInt = typeof shares === 'string' ? BigInt(shares) : shares;
  
  // Ensure addresses are checksummed
  const vaultAddress = ethers.getAddress(l1Vault);
  const receiverAddress = ethers.getAddress(receiver);
  
  // Encode the payload: (uint256 nonce, uint8 messageType, address l1Vault, address receiver, uint256 shares)
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encodedPayload = abiCoder.encode(
    ['uint256', 'uint8', 'address', 'address', 'uint256'],
    [nonce, messageType, vaultAddress, receiverAddress, sharesBigInt]
  );
  
  // Compute keccak256 hash
  const payloadHash = ethers.keccak256(encodedPayload);
  
  return payloadHash;
}

