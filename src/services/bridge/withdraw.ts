import { toast } from "sonner";
import { BrowserProvider, Provider, Signer } from "via-ethers";
import { ethers } from "ethers";
import { L2_BTC_DECIMALS } from "../constants";
import { getNetworkConfig } from "../config";

export interface WithdrawParams {
  amount: string;
  recipientBitcoinAddress: string;
}

export interface WithdrawResult {
  txHash: string;
  explorerUrl: string;
}

export async function executeWithdraw(params: WithdrawParams): Promise<WithdrawResult> {
  try {
    // Connect to the browser wallet
    const browserProvider = new BrowserProvider((window as any).ethereum);
    const provider = new Provider(getNetworkConfig().rpcUrls[0]);
    
    // Get the browser signer and ensure it has the required properties
    const browserSigner = await browserProvider.getSigner();
    const network = await browserProvider.getNetwork();
    
    // Create the VIA signer
    const signer = Signer.from(
      browserSigner as unknown as Parameters<typeof Signer.from>[0],
      Number(network.chainId),
      provider
    );
    
    // Convert amount to L2 token decimals (18 decimals)
    const l2SatsAmount = ethers.parseUnits(params.amount, L2_BTC_DECIMALS);

    // Execute withdrawal
    const tx = await signer.withdraw({
      to: params.recipientBitcoinAddress,
      amount: l2SatsAmount,
    });

    // Wait for transaction receipt
    const receipt = await tx.wait();
    const txHash = receipt.hash;

    const explorerUrl = `https://testnet.blockscout.onvia.org/tx/${txHash}`;

    return {
      txHash,
      explorerUrl,
    };
  } catch (error) {
    console.error("Withdrawal error:", error);
    toast.error("Withdrawal failed", {
      description: "There was an error processing your withdrawal. Please try again.",
    });
    throw error;
  }
} 