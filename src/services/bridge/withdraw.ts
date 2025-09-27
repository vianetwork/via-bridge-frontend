import { toast } from "sonner";
import { BrowserProvider, Provider, Signer } from "via-ethers";
import { ethers } from "ethers";
import { L2_BTC_DECIMALS } from "../constants";
import { getNetworkConfig } from "../config";
import {getPreferredWeb3ProviderAsync} from "@/utils/ethereum-provider";
import { useWalletStore } from "@/store/wallet-store";
import {eip6963Store} from "@/utils/eip6963-provider";
import { withTimeout } from "@/utils/promise";

const CONNECT_TIMEOUT_MS = 10000; // 10-second timeout
const BALANCE_TIMEOUT_MS = 5000; // 5-second timeout
const SIGN_TIMEOUT_MS = 20000;  // 20-second timeout

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
    const { selectedWallet, viaAddress } = useWalletStore.getState();
    let chosen: { provider: EIP1193Provider; name: string; rdns: string} | null = null;
    if (selectedWallet) {
      const detail = eip6963Store.getProviderByRdns(selectedWallet);
      if (detail) chosen = { provider: detail.provider, name: detail.info.name, rdns: detail.info.rdns };
    }

    if (!chosen) chosen = await getPreferredWeb3ProviderAsync(CONNECT_TIMEOUT_MS);

    if (!chosen) {
      const msg = "No EVM wallet found. Please install Metamask, Rabby or Coinbase Wallet to continue.";
      toast.error(msg, {description: msg,});
      throw new Error(msg);
    }

    const providerApi = chosen.provider; // injected provider from the selected wallet (MetaMask/Rabby/Coinbase)
    const browserProvider = new BrowserProvider((providerApi));
    const provider = new Provider(getNetworkConfig().rpcUrls[0]);

    // Wallet handshake: first probe existing accounts (eth_accounts, no popup).
    // If none, prompt connect (eth_requestAccounts) with a timeout to avoid freezing UI.
    let accounts = (await providerApi.request({ method: "eth_accounts" }).catch(() => [])) as string[];
    if (!accounts || accounts.length === 0) {
      accounts = await withTimeout(
        providerApi.request({ method: "eth_requestAccounts" }) as Promise<string[]>,
        CONNECT_TIMEOUT_MS,
        "Wallet did not open to connect. Please open your wallet and try again."
      );
    }

    const signerAddr = accounts[0];
    if(!signerAddr) {
      const msg = "No accounts returned from wallet. Please connect your wallet and try again.";
      toast.error("Wallet error", {description: msg,});
      throw new Error(msg);
    }

    // Get network info
    const browserSigner = await browserProvider.getSigner();
    const network = await browserProvider.getNetwork();

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
    const balWei = await withTimeout(
      provider.getBalance(signerAddr),
    BALANCE_TIMEOUT_MS,
    "Balance check timed out. Please try again."
    );

    if (balWei < l2SatsAmount) {
      const msg = "Insufficient balance to cover withdrawal. Please check your wallet balance and try again.";
      toast.error("Insufficient balance", {description: msg,});
      throw new Error(msg);
    }
    
    // Create the VIA signer
    const signer = Signer.from(browserSigner as unknown as Parameters<typeof Signer.from>[0],
      Number(network.chainId),
      provider
    );

    const tx = await withTimeout(
      signer.withdraw({to: params.recipientBitcoinAddress,  amount: l2SatsAmount,}),
      SIGN_TIMEOUT_MS, // 10-second timeout
      "No signing request detected. Your wallet may be locked or the popup was blocked. Unlock your wallet and approve the transaction. If no prompt appears, open the wallet extension manually and try again."
    );

    const txHash = tx.hash;
    const explorerUrl = `https://testnet.blockscout.onvia.org/tx/${txHash}`;

    return {
      txHash,
      explorerUrl,
    };
  } catch (error: any) {
    console.error("Withdrawal error:", error);
    if (error?.code === 4001) {
      toast.error("Request rejected", {description: "You rejected the request in your wallet.",});
    } else {
      toast.error("Withdrawal failed", {description: (error as Error)?.message || "There was an error processing your withdrawal. Please try again.",});
    }
    throw error;
  }
}
