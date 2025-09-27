import FaucetInterface from "@/components/faucet-interface";
import { env } from "@/lib/env";
import { BitcoinNetwork } from "@/services/bitcoin/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function FaucetPage() {
  const currentNetwork = env().NEXT_PUBLIC_NETWORK;
  const isTestnet = currentNetwork === BitcoinNetwork.TESTNET || currentNetwork === BitcoinNetwork.REGTEST;

  if (!isTestnet) {
    return (
      <main className="bg-background flex-1 flex flex-col justify-start py-6">
        <div className="container max-w-4xl mx-auto px-4 flex flex-col">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold mb-2">
              VIA Faucet
            </h1>
            <p className="text-sm text-slate-500 max-w-2xl mx-auto">
              Faucet is only available on testnet
            </p>
          </div>
          <div className="flex items-start justify-center">
            <Alert className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                The faucet is only available on testnet networks. 
                Please switch to testnet to access the faucet functionality.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background flex-1 flex flex-col justify-start py-6">
      <div className="container max-w-4xl mx-auto px-4 flex flex-col">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">
            VIA Testnet Faucet
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl mx-auto">
            Get test BTC on the VIA network for testing and development
          </p>
        </div>
        <div className="flex items-start justify-center">
          <FaucetInterface />
        </div>
      </div>
    </main>
  );
}
