import BridgeInterface from "@/components/bridge-interface";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            VIA Bridge
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto font-medium">
            Transfer assets between Bitcoin and VIA network
          </p>
        </div>
        <BridgeInterface />
      </div>
    </main>
  );
}
