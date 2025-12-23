import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <main className="bg-background flex-1 flex flex-col justify-center items-center py-6 min-h-[calc(100vh-200px)]">
      <div className="container max-w-7xl mx-auto px-4 flex flex-col items-center justify-center flex-1 w-full">
        <div className="text-center mb-12 w-full">
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            VIA Bridge
          </h1>
          <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto">
            Bridge assets securely between Bitcoin, Ethereum, and VIA network
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto w-full items-center justify-center">
          <Link href="/bitcoin-bridge" className="group flex">
            <Card className="w-full flex flex-col transition-all duration-200 hover:shadow-xl hover:border-primary/50 cursor-pointer min-h-[400px] md:min-h-[500px]">
              <CardHeader className="flex-1 flex flex-col items-center justify-center pb-8 text-center">
                <div className="flex flex-col items-center gap-6 mb-6">
                  <div className="p-6 bg-orange-100 rounded-2xl">
                    <Image
                      src="/bitcoin-logo.svg"
                      alt="Bitcoin"
                      width={64}
                      height={64}
                      className="h-16 w-16"
                    />
                  </div>
                  <CardTitle className="text-3xl md:text-4xl">Bitcoin Bridge</CardTitle>
                </div>
                <CardDescription className="text-lg md:text-xl">
                  Bridge BTC between Bitcoin and VIA network
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-center text-primary font-semibold text-lg group-hover:gap-2 transition-all">
                  <span>Go to Bitcoin Bridge</span>
                  <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/ethereum-bridge" className="group flex">
            <Card className="w-full flex flex-col transition-all duration-200 hover:shadow-xl hover:border-primary/50 cursor-pointer min-h-[400px] md:min-h-[500px]">
              <CardHeader className="flex-1 flex flex-col items-center justify-center pb-8 text-center">
                <div className="flex flex-col items-center gap-6 mb-6">
                  <div className="p-6 bg-blue-100 rounded-2xl">
                    <Image
                      src="/ethereum-bridge.png"
                      alt="Ethereum"
                      width={64}
                      height={64}
                      className="h-16 w-16"
                    />
                  </div>
                  <CardTitle className="text-3xl md:text-4xl">Ethereum Bridge</CardTitle>
                </div>
                <CardDescription className="text-lg md:text-xl">
                  Bridge USDC and other assets between Ethereum and VIA network
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-center text-primary font-semibold text-lg group-hover:gap-2 transition-all">
                  <span>Go to Ethereum Bridge</span>
                  <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </main>
  );
}
