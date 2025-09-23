import { toast } from "sonner";
import { BrowserProvider, Provider, Signer } from "via-ethers";
import { ethers } from "ethers";
import { L2_BTC_DECIMALS } from "../constants";
import { getNetworkConfig } from "../config";
import {getPreferredWeb3Provider, getPreferredWeb3ProviderAsync} from "@/utils/ethereum-provider";
import { useWalletStore } from "@/store/wallet-store";

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
    const best = await getPreferredWeb3Provider();
    if (!best) {
      const msg = "No EVM wallet found. Please install Metamask, Rabby or Coinbase Wallet to continue.";
      toast.error(msg, {description: msg,});
      throw new Error(msg);
    }
    const browserProvider = new BrowserProvider(best.provider);
    const provider = new Provider(getNetworkConfig().rpcUrls[0]);
    
    // Get the browser signer and ensure it has the required properties
    const browserSigner = await browserProvider.getSigner();
    const network = await browserProvider.getNetwork();

    // Check account, chain id and balance
    const signerAddr = await browserSigner.getAddress();
    const { viaAddress }  = useWalletStore.getState();
    if (viaAddress && viaAddress.toLowerCase() !== signerAddr.toLowerCase()) {
      const msg = `Active wallet address (${signerAddr}) differs from connected address (${viaAddress}). Please re-connect to the correct wallet.`;
      toast.error(msg, {description: msg,});
      throw new Error(msg);
    }

    // Check if the correct chain is selected
    const expectedChainId = Number((await import("@/services/config")).VIA_NETWORK_CONFIG[(await import("@/services/config")).BRIDGE_CONFIG.defaultNetwork].chainId);
    if (Number(network.chainId) !== expectedChainId) {
      const msg  = `Wrong network. Expected chain ID: ${expectedChainId}, but got: ${network.chainId}`;
      toast.error("Wrong network", {description: msg,});
      throw new Error(msg);
    }

    // Convert amount to L2 token decimals (18 decimals) and wallet balance check before signing
    const l2SatsAmount = ethers.parseUnits(params.amount, L2_BTC_DECIMALS);
    const balWei = await provider.getBalance(signerAddr);
    if (balWei < l2SatsAmount) {
      const msg = "Insufficient balance to cover withdrawal. Please check your wallet balance and try again.";
      toast.error("Insufficient balance", {description: msg,});
      throw new Error(msg);
    }
    
    // Create the VIA signer
    const signer = Signer.from(
      browserSigner as unknown as Parameters<typeof Signer.from>[0],
      Number(network.chainId),
      provider
    );
    
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