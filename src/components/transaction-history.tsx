
import { useWalletStore } from "@/store/wallet-store";
import { ExternalLink, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

interface TransactionHistoryProps {
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function TransactionHistory({ isLoading = false, onRefresh }: TransactionHistoryProps) {
  const { transactions } = useWalletStore();

  // For testing purposes only - add this before the return statement
  // and remove it once scrolling is confirmed working
  const testTransactions = isLoading || transactions.length > 0 ? transactions : Array(10).fill(null).map((_, i) => ({
    id: `test-${i}`,
    type: i % 2 === 0 ? 'deposit' : 'withdraw',
    amount: '0.01',
    status: i % 3 === 0 ? 'pending' : i % 3 === 1 ? 'completed' : 'failed',
    timestamp: Date.now() - i * 3600000,
    txHash: `0x${i}${'0'.repeat(63)}`,
    explorerUrl: '#',
  }));
  
  // { <div className="flex justify-between items-center mb-2">
  //   {/* <h3 className="text-sm font-medium">Recent Transactions</h3> */}
  //   {onRefresh && (
  //     <Button 
  //       variant="ghost" 
  //       size="sm" 
  //       onClick={onRefresh} 
  //       disabled={isLoading}
  //       className="h-8 w-8 p-0"
  //     >
  //       <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
  //       <span className="sr-only">Refresh</span>
  //     </Button>
  //   )}
  // </div> }
  return (
    <div className="w-full">

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
          <div className="h-[100px] overflow-y-auto pr-1">
            <div className="space-y-2 p-2">
              {testTransactions.map((tx) => (
                <div key={tx.id} className="flex items-start justify-between rounded-md border p-3 text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {tx.status === 'pending' && <Clock className="h-4 w-4 text-amber-500" />}
                      {tx.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                      {tx.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                      <span className="font-medium capitalize">{tx.type}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(tx.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tx.amount} BTC
                    </div>
                    <div className="text-xs font-mono text-muted-foreground truncate max-w-[180px]">
                      {tx.txHash}
                    </div>
                  </div>
                  <a
                    href={tx.explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
