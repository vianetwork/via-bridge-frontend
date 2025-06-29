
import { useWalletStore } from "@/store/wallet-store";
import { ExternalLink, Clock, CheckCircle, XCircle, RefreshCw, HelpCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

interface TransactionHistoryProps {
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function TransactionHistory({ isLoading = false, onRefresh }: TransactionHistoryProps) {
  const { transactions } = useWalletStore();

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium">Recent Transactions</h3>
        <div className="flex items-center space-x-2">
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <span className="sr-only">Refresh</span>
          <div className="relative group">
            <HelpCircle className="h-5 w-5 text-gray-400 hover:text-gray-600 cursor-help" />
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0 mb-2 px-3 py-2 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-[9999] max-w-xs shadow-lg border border-gray-700">
              <div className="text-left space-y-1">
                <div><span className="text-gray-300 font-bold">Deposit</span></div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-yellow-400">InProgress:</span> Transaction in progress
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-400">Processed:</span> Transaction completed successfully
                </div>

                <div><span className="text-gray-300 font-bold">Withdraw</span></div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-blue-400">ExecutedOnL2:</span> Transaction executed on L2
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-yellow-400">CommittedToL1:</span> Committed to L1 blockchain
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-orange-500" />
                  <span className="text-orange-400">ProvedOnL1:</span> Proof verified on L1
                </div>
                <div className="flex items-center space-x-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span className="text-purple-400">ExecutedOnL1:</span> Executed on L1 blockchain
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-400">Processed:</span> Transaction completed successfully
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {isLoading && transactions.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Loading transactions...
        </div>
      ) : transactions.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No transactions yet
        </div>
      ) : (
        <div className="border rounded-md">
          <div className="h-[150px] overflow-y-auto pr-1">
            <div className="space-y-2 p-2">
              {transactions.map((tx) => (
                <div key={tx.txHash} className="flex items-start justify-between rounded-md border p-3 text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {tx.status === 'ExecutedOnL2' && <Clock className="h-4 w-4 text-blue-500" />}
                      {tx.status === 'CommittedToL1' && <Clock className="h-4 w-4 text-yellow-500" />}
                      {tx.status === 'ProvedOnL1' && <Clock className="h-4 w-4 text-orange-500" />}
                      {tx.status === 'ExecutedOnL1' && <Clock className="h-4 w-4 text-purple-500" />}
                      {tx.status === 'InProgress' && <Clock className="h-4 w-4 text-amber-500" />}
                      {tx.status === 'Processed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {tx.status === 'Failed' && <XCircle className="h-4 w-4 text-red-500" />}

                      <span className="font-medium capitalize">{tx.type} {tx.amount} BTC</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(tx.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                    {/* L1/L2 Explorer Links */}
                    <div className="flex items-center gap-3 mt-2">
                      {tx.l1ExplorerUrl && (
                        <a
                          href={tx.l1ExplorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          L1 Explorer
                        </a>
                      )}
                      {tx.l2ExplorerUrl && (
                        <a
                          href={tx.l2ExplorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          L2 Explorer
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
