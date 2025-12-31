import EthereumBridgeInterface from "@/components/ethereum-bridge-interface";

export default function EthereumBridgePage() {
    return (
        <main className="bg-background flex-1 flex flex-col justify-start py-6">
            <div className="container max-w-6xl mx-auto px-4 flex flex-col">
                <div className="text-center mb-4">
                    <h1 className="text-3xl font-bold mb-2">
                        Ethereum Bridge
                    </h1>
                    <p className="text-sm text-slate-500 max-w-2xl mx-auto">
                        Bridge assets securely between Ethereum and Via network
                    </p>
                </div>
                <div className="flex items-start justify-center">
                    <EthereumBridgeInterface />
                </div>
            </div>
        </main>
    );
}
