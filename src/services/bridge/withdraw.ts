import { toast } from "sonner";
import { BrowserProvider, Provider, types, Signer } from "via-ethers";
import { ethers } from "ethers";
import { L2_BTC_DECIMALS } from "../constants";

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
    const signer = Signer.from(
      await browserProvider.getSigner(),
      Number((await browserProvider.getNetwork()).chainId),
      Provider.getDefaultProvider(types.Network.Localhost)
    );

    // Convert amount to L2 token decimals (18 decimals)
    const l2SatsAmount = ethers.parseUnits(params.amount, L2_BTC_DECIMALS);

    // Execute withdrawal
    const tx = await signer.withdraw({
      to: params.recipientBitcoinAddress,
      amount: l2SatsAmount
    });

    // Wait for transaction receipt
    const receipt = await tx.wait();
    const txHash = receipt.hash;

    // TODO: Update explorer URL
    const explorerUrl = `https://explorer.testnet.viablockchain.xyz/tx/${txHash}`;

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