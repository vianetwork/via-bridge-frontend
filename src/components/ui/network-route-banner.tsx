"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faViacoin, faBitcoin } from "@fortawesome/free-brands-svg-icons";

type Direction = "deposit" | "withdraw";
type Network = "bitcoin" | "via";

interface NetworkRouteBannerProps {
  direction: Direction;
  tokenSymbol?: string;
  className?: string;
}

function ViaBadge() {
  return (
    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
      <FontAwesomeIcon icon={faViacoin} className="text-primary" style={{ width: 20, height: 20}} />
    </div>
  );
}

function Side({ network }: { network: Network }) {
  if (network === "bitcoin") {
    return (
      <div className="flex items-center gap-2">
        <FontAwesomeIcon icon={faBitcoin} className="text-amber-500" style={{ width: 20, height: 20 }} />
        <div className="flex flex-col">
          <span className="text-sm font-medium">Bitcoin</span>
          <span className="text-xs text-muted-foreground">Network</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <ViaBadge />
      <div className="flex flex-col">
        <span className="text-sm font-medium">VIA</span>
        <span className="text-xs text-muted-foreground">Network</span>
      </div>
    </div>
  );
}

export default function NetworkRouteBanner({direction, tokenSymbol = "BTC", className,}: NetworkRouteBannerProps) {
  const [fromNet, toNet]: [Network, Network] =
    direction === "deposit" ? ["bitcoin", "via"] : ["via", "bitcoin"];

  return (
    <div className={cn("flex items-center justify-between bg-muted/50 rounded-lg p-3 mb-4", className)}>
      <Side network={fromNet} />
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1 px-2 py-1 bg-primary/5 rounded-full">
          <FontAwesomeIcon icon={faBitcoin} className="text-amber-500" style={{ width: 14, height: 14 }} />
          <span className="text-xs font-medium">{tokenSymbol}</span>
        </div>
        <ArrowRight className="h-5 w-10 text-primary" strokeWidth={2.5} />
      </div>
      <Side network={toNet} />
    </div>
  );
}
