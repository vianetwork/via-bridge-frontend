import axios from "axios";
import { L1_BTC_DECIMALS, L2_BTC_DECIMALS } from "../constants";
import { ethers } from "ethers";
import { TransactionStatus } from "@/store/wallet-store";
import { API_BASE_URL, API_CONFIG, BRIDGE_CONFIG, getNetworkConfig } from "../config";
import { computeWithdrawalPayloadHash } from "@/utils/payload-hash";

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
      `${API_BASE_URL}/user/btc/deposit-withdrawal`,
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
    l2ExplorerUrl: deposit.l2_tx_hash ? new URL(`tx/${deposit.l2_tx_hash}`, getNetworkConfig().blockExplorerUrls[0]).toString() : undefined,
  }));

  const mappedWithdrawals = withdrawals.map(withdrawal => ({
    id: `withdrawal-${withdrawal.l2_tx_hash}`,
    type: 'withdraw' as const,
    amount: ethers.formatUnits(withdrawal.amount, L2_BTC_DECIMALS),
    status: withdrawal.status as TransactionStatus,
    timestamp: withdrawal.created_at * 1000,
    txHash: withdrawal.l2_tx_hash,
    l2ExplorerUrl: new URL(`tx/${withdrawal.l2_tx_hash}`, getNetworkConfig().blockExplorerUrls[0]).toString(),
    l1TxHash: withdrawal.bridge_withdrawal?.tx_id || undefined,
    l1ExplorerUrl: withdrawal.bridge_withdrawal?.tx_id ? API_CONFIG.endpoints.bitcoin.explorer[BRIDGE_CONFIG.defaultNetwork] + withdrawal.bridge_withdrawal.tx_id : undefined,
  }));

  return [...mappedDeposits, ...mappedWithdrawals];
}

// Ethereum API Type Definitions
interface EthDepositData {
  id: string;
  shares: string;
  transaction_hash: string;
  block_timestamp: string;
  receiver: string;
}

interface EthExecutionData {
  transaction_hash: string;
  block_timestamp: string;
}

interface EthDepositResponseItem {
  l1_deposit: EthDepositData;
  l2_execution: EthExecutionData | null;
}

interface EthWithdrawalData {
  id: string;
  nonce: string;
  l1_vault: string;
  l2_vault: string;
  receiver: string; // L1 recipient address for claiming
  shares: string;
  block_number: string;
  block_timestamp: string;
  transaction_hash: string;
}

interface EthWithdrawalResponseItem {
  l2_withdrawal: EthWithdrawalData;
  l1_execution: EthExecutionData | null;
}

interface EthTransactionsResponseData {
  deposits: EthDepositResponseItem[];
  withdrawals: EthWithdrawalResponseItem[];
}

// Function to fetch ETH user transactions
export async function fetchEthUserTransactions(
  l1Address: string | null,
  l2Address: string | null
): Promise<EthTransactionsResponseData> {
  try {
    if (!l1Address || !l2Address) {
      return { deposits: [], withdrawals: [] };
    }

    const response = await axios.get<{ success: boolean, data: EthTransactionsResponseData, message: string }>(
      `${API_BASE_URL}/user/eth/deposit-withdrawal`,
      {
        params: {
          l1_address: l1Address,
          l2_address: l2Address,
        },
      }
    );

    if (!response.data.success) {
      throw new Error(response.data.message || "Failed to fetch ETH transactions");
    }

    return response.data.data;
  } catch (error) {
    console.error("Error fetching ETH transactions:", error);
    return { deposits: [], withdrawals: [] };
  }
}

export function mapEthApiTransactionsToAppFormat(data: EthTransactionsResponseData) {
  const { deposits, withdrawals } = data;

  const mappedDeposits = deposits.map(item => {
    const deposit = item.l1_deposit;
    const execution = item.l2_execution;
    const amount = ethers.formatUnits(deposit.shares, 6); // Assuming USDC (6 decimals)

    // Determine status
    let status: TransactionStatus = 'CommittedToL1';
    if (execution) {
      status = 'ExecutedOnL2';
    }

    return {
      id: `deposit-${deposit.transaction_hash}`,
      type: 'deposit' as const,
      amount: amount,
      status: status,
      timestamp: parseInt(deposit.block_timestamp) * 1000,
      txHash: deposit.transaction_hash,
      l1ExplorerUrl: `https://sepolia.etherscan.io/tx/${deposit.transaction_hash}`,
      l2TxHash: execution?.transaction_hash,
      l2ExplorerUrl: execution?.transaction_hash ? new URL(`tx/${execution.transaction_hash}`, getNetworkConfig().blockExplorerUrls[0]).toString() : undefined,
      symbol: "USDC"
    };
  });

  const mappedWithdrawals = withdrawals.map(item => {
    const withdrawal = item.l2_withdrawal;
    const execution = item.l1_execution;
    const amount = ethers.formatUnits(withdrawal.shares, 6);

    // Determine status
    let status: TransactionStatus = 'ExecutedOnL2'; // or 'Processed' on L2?
    if (execution) {
      status = 'ExecutedOnL1'; // Finalized
    }

    // Compute the payload hash from withdrawal data (matching contract logic)
    const payloadHash = computeWithdrawalPayloadHash(
      withdrawal.nonce,
      withdrawal.l1_vault,
      withdrawal.receiver,
      withdrawal.shares
    );

    return {
      id: `withdrawal-${withdrawal.transaction_hash}`,
      type: 'withdraw' as const,
      amount: amount,
      status: status,
      timestamp: parseInt(withdrawal.block_timestamp) * 1000,
      txHash: withdrawal.transaction_hash,
      l2ExplorerUrl: new URL(`tx/${withdrawal.transaction_hash}`, getNetworkConfig().blockExplorerUrls[0]).toString(),
      l1TxHash: execution?.transaction_hash,
      l1ExplorerUrl: execution?.transaction_hash ? `https://sepolia.etherscan.io/tx/${execution.transaction_hash}` : undefined,
      symbol: "USDC",
      // Additional fields for pending withdrawals
      withdrawalId: withdrawal.nonce, // nonce for claiming
      withdrawalShares: withdrawal.shares, // shares amount
      withdrawalRecipient: withdrawal.receiver, // L1 recipient address
      withdrawalL1Vault: withdrawal.l1_vault, // L1 vault address
      withdrawalPayloadHash: payloadHash, // computed payload hash for checking readiness
      isPendingClaim: !execution, // true if l1_execution is null
    };
  });

  return [...mappedDeposits, ...mappedWithdrawals];
}
