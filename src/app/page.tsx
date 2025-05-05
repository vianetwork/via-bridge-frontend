import BridgeInterface from "@/components/bridge-interface";

export default function Home() {
  return (
    <main className="bg-background flex-1 flex flex-col justify-center">
      <div className="container max-w-6xl mx-auto py-6 px-4 flex flex-col">
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold mb-2">
            VIA Bridge
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl mx-auto">
            Transfer assets between Bitcoin and VIA network
          </p>
        </div>
        <div className="flex items-start justify-center">
          <BridgeInterface />
        </div>
      </div>
    </main>
  );
}
