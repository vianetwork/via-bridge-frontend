import axios from "axios";
import { L1_BTC_DECIMALS, L2_BTC_DECIMALS } from "../constants";
import { ethers } from "ethers";
import { TransactionStatus } from "@/store/wallet-store";
import { API_BASE_URL, API_CONFIG, BRIDGE_CONFIG, getNetworkConfig } from "../config";

// Define types for the API response
interface Deposit {
  status: string,
  block_number: number,
  l2_receiver: string,
  value: number,
  l1_tx_id: string,
  l2_tx_hash: string,
  created_at: number
}

interface BridgeWithdrawal {
  tx_id: string,
  fee: number,
  withdrawals_count: number,
  block_number: number,
  created_at: number,
}

interface Withdrawal {
  status: string,
  l2_sender: string,
  l1_receiver: string,
  amount: string,
  block_number: number,
  created_at: number,
  l2_tx_hash: string,
  bridge_withdrawal: BridgeWithdrawal,
}

interface TransactionsResponse {
  success: boolean;
  data: {
    deposits: Deposit[];
    withdrawals: Withdrawal[];
  };
  message: string;
}

// Function to fetch user transactions
export async function fetchUserTransactions(
  bitcoinAddress: string | null,
  viaAddress: string | null
): Promise<TransactionsResponse["data"]> {
  try {
    if (!bitcoinAddress || !viaAddress) {
      return { deposits: [], withdrawals: [] };
    }

    const response = await axios.get<TransactionsResponse>(
      `${API_BASE_URL}/user/deposit_withdrawal`,
      {
        params: {
          l1_account: bitcoinAddress,
          l2_account: viaAddress,
        },
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || "Failed to fetch transactions");
    }

    return response.data.data;
  } catch (error) {
    console.error("Error fetching user transactions:", error);
    return { deposits: [], withdrawals: [] };
  }
}

// Helper function to convert transaction data to our app's format
export function mapApiTransactionsToAppFormat(data: TransactionsResponse["data"]) {
  const { deposits, withdrawals } = data;

  const mappedDeposits = deposits.map(deposit => ({
    id: `deposit-${deposit.l1_tx_id}`,
    type: 'deposit' as const,
    amount: ethers.formatUnits(deposit.value.toString(), L1_BTC_DECIMALS),
    status: deposit.status as TransactionStatus,
    timestamp: deposit.created_at * 1000,
    txHash: deposit.l1_tx_id,
    l1ExplorerUrl: API_CONFIG.endpoints.bitcoin.explorer[BRIDGE_CONFIG.defaultNetwork] + deposit.l1_tx_id,
    l2TxHash: deposit.l2_tx_hash || undefined,
    l2ExplorerUrl: deposit.l2_tx_hash ? getNetworkConfig().blockExplorerUrls[0] + deposit.l2_tx_hash : undefined,
  }));

  const mappedWithdrawals = withdrawals.map(withdrawal => ({
    id: `withdrawal-${withdrawal.l2_tx_hash}`,
    type: 'withdraw' as const,
    amount: ethers.formatUnits(withdrawal.amount, L2_BTC_DECIMALS),
    status: withdrawal.status as TransactionStatus,
    timestamp: withdrawal.created_at * 1000,
    txHash: withdrawal.l2_tx_hash,
    l2ExplorerUrl: getNetworkConfig().blockExplorerUrls[0] + withdrawal.l2_tx_hash,
    l1TxHash: withdrawal.bridge_withdrawal?.tx_id || undefined,
    l1ExplorerUrl: withdrawal.bridge_withdrawal?.tx_id ? API_CONFIG.endpoints.bitcoin.explorer[BRIDGE_CONFIG.defaultNetwork] + withdrawal.bridge_withdrawal.tx_id : undefined,
  }));

  return [...mappedDeposits, ...mappedWithdrawals];
}

