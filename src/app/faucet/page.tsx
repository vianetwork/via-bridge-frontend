import FaucetInterface from "@/components/faucet-interface";
import { env } from "@/lib/env";
import { notFound } from "next/navigation";

export default function FaucetPage() {
  const enableFaucet = env().NEXT_PUBLIC_ENABLE_FAUCET;

  if (!enableFaucet) {
    console.log("FAUCET DISABLED");
    return notFound();
  }

  return (
    <main className="bg-background flex-1 flex flex-col justify-start py-6">
      <div className="container max-w-4xl mx-auto px-4 flex flex-col">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold mb-2">
            VIA Testnet Faucet
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl mx-auto">
            Get VIA Testnet BTC for testing and development
          </p>
        </div>
        <div className="flex items-start justify-center">
          <FaucetInterface />
        </div>
      </div>
    </main>
  );
}
