"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Direction = "deposit" | "withdraw";
type Network = "bitcoin" | "via";

interface NetworkRouteBannerProps {
  direction: Direction;
  tokenSymbol?: string;
  tokenIconSrc?: string;
  className?: string;
}

function ViaDot() {
  return (
    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
      <div className="h-3 w-3 rounded-full bg-primary" />
    </div>
  );
}

function Side({ network }: { network: Network }) {
  if (network === "bitcoin") {
    return (
      <div className="flex items-center gap-2">
        <Image  src="/bitcoin-logo.svg"  alt="Bitcoin"  width={20}  height={20}  className="text-amber-500"/>
        <div className="flex flex-col">
          <span className="text-sm font-medium">Bitcoin</span>
          <span className="text-xs text-muted-foreground">Network</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <ViaDot />
      <div className="flex flex-col">
        <span className="text-sm font-medium">VIA</span>
        <span className="text-xs text-muted-foreground">Network</span>
      </div>
    </div>
  );
}

export default function NetworkRouteBanner({direction, tokenSymbol = "BTC", tokenIconSrc = "/bitcoin-logo.svg", className,}: NetworkRouteBannerProps) {
  const [left, right]: [Network, Network] =
    direction === "deposit" ? ["bitcoin", "via"] : ["via", "bitcoin"];

  return (
    <div className={cn("flex items-center justify-between bg-muted/50 rounded-lg p-3 mb-4", className)}>
      <Side network={left} />
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1 px-2 py-1 bg-primary/5 rounded-full">
          <Image  src={tokenIconSrc}  alt={tokenSymbol}  width={14}  height={14}  className="text-amber-500"/>
          <span className="text-xs font-medium">{tokenSymbol}</span>
        </div>
        <ArrowRight className="h-5 w-10 text-primary" strokeWidth={2.5} />
      </div>
      <Side network={right} />
    </div>
  );
}
