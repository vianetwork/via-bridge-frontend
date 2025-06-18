import axios from "axios";
import { L2_BTC_DECIMALS } from "../constants";
import { ethers } from "ethers";

// Define the API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://0.0.0.0:5000";

// Define types for the API response
interface Deposit {
  priority_id: number;
  status: string;
  l1_tx_id: string;
  block_number: number;
  l2_receiver: string;
  value: number | string;
  calldata: string;
  l2_tx_hash: string;
  created_at: number;
}

interface BridgeWithdrawal {
  bridge_withdrawal_id: number;
  tx_id: string;
  l1_batch_reveal_tx_id: string;
  fee: number;
  vsize: number;
  total_size: number;
  withdrawals_count: number;
  block_number: number;
  created_at: number;
}

interface Withdrawal {
  id: string;
  l2_sender: string;
  l1_receiver: string;
  amount: string;
  block_number: number;
  block_timestamp: number;
  l2_tx_hash: string;
  bridge_withdrawal?: BridgeWithdrawal;
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
    if (!bitcoinAddress && !viaAddress) {
      return { deposits: [], withdrawals: [] };
    }

    console.log({bitcoinAddress})
    console.log({viaAddress})

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
    amount: ethers.formatUnits(deposit.value.toString(), L2_BTC_DECIMALS),
    status: mapApiStatusToAppStatus(deposit.status),
    timestamp: deposit.created_at * 1000, // Convert to milliseconds
    txHash: deposit.l1_tx_id,
    explorerUrl: getExplorerUrl('bitcoin', deposit.l1_tx_id),
    l2TxHash: deposit.l2_tx_hash || null,
    l2ExplorerUrl: deposit.l2_tx_hash ? getExplorerUrl('via', deposit.l2_tx_hash) : null,
  }));
  
  const mappedWithdrawals = withdrawals.map(withdrawal => ({
    id: `withdrawal-${withdrawal.l2_tx_hash}`,
    type: 'withdraw' as const,
    amount: ethers.formatUnits(withdrawal.amount, L2_BTC_DECIMALS),
    status: withdrawal.bridge_withdrawal ? 'completed' : 'pending',
    timestamp: withdrawal.block_timestamp * 1000, // Convert to milliseconds
    txHash: withdrawal.l2_tx_hash,
    explorerUrl: getExplorerUrl('via', withdrawal.l2_tx_hash),
    l1TxHash: withdrawal.bridge_withdrawal?.tx_id || null,
    l1ExplorerUrl: withdrawal.bridge_withdrawal?.tx_id ? getExplorerUrl('bitcoin', withdrawal.bridge_withdrawal.tx_id) : null,
  }));
  
  return [...mappedDeposits, ...mappedWithdrawals].sort((a, b) => b.timestamp - a.timestamp);
}

// Helper function to map API status to app status
function mapApiStatusToAppStatus(status: string): 'pending' | 'completed' | 'failed' {
  switch (status.toLowerCase()) {
    case 'processed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

// Helper function to get explorer URL
function getExplorerUrl(chain: 'bitcoin' | 'via', txHash: string): string {
  if (chain === 'bitcoin') {
    // Use the appropriate Bitcoin explorer based on network
    return `https://mempool.space/testnet/tx/${txHash}`;
  } else {
    // Use the appropriate VIA explorer
    return `https://explorer.testnet.viablockchain.xyz/tx/${txHash}`;
  }
}