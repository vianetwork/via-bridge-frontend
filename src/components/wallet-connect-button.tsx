"use client";

import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { getPreferredWeb3ProviderAsync } from "@/utils/ethereum-provider";
import { resolveIcon } from "@/utils/wallet-metadata";
import { eip6963Store } from "@/utils/eip6963-provider";

interface WalletConnectButtonProps {
  walletType: "xverse" | "metamask"
  isConnected: boolean
  onConnect: () => Promise<boolean>
  onDisconnect: () => void
}

export default function WalletConnectButton({
  walletType,
  isConnected,
  onConnect,
  onDisconnect,
}: WalletConnectButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletName, setWalletName] = useState(walletType === "xverse" ? "Xverse" : "MetaMask");
  const [walletIcon, setWalletIcon] = useState<string | null>(walletType === "xverse" ? "/xverse-logo.svg" : "/metamask-logo.svg");

  useEffect(() => {
    let cancelled = false;

    async function updateMeta() {
      if (walletType === "metamask") {
        try {
          const best = await getPreferredWeb3ProviderAsync(500);
          if (cancelled) return;

          setWalletName(best?.name ?? "MetaMask");

          let iconUrl: string | undefined = undefined;
          try {
            const detail = eip6963Store.getAllWalletProviders().find(p => p.info.rdns === best?.rdns);
            iconUrl = detail ? resolveIcon(detail) : undefined;
          } catch {
            // ignore resolver errors
          }
          setWalletIcon(iconUrl ?? "/metamask-logo.svg");
        } catch {
          if (!cancelled) {
            setWalletName("MetaMask");
            setWalletIcon("/metamask-logo.svg");
          }
        }
      } else {
        setWalletName("Xverse");
        setWalletIcon("/xverse-logo.svg");
      }
    }

    updateMeta();
    return () => { cancelled = true; };
  }, [walletType]);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      const connected = await onConnect();
      if (connected) {
        toast.success(`${walletName} Connected`, {
          description: `Successfully connected to your ${walletName} wallet.`,
          duration: 4000,
          className: "text-base font-medium",
        });
      }
    } catch (error) {
      console.error(`${walletType} connection error:`, error);
      toast.error("Connection Failed", {
        description: `Unable to connect to ${walletName}. Please try again.`,
        duration: 4000,
        className: "text-base font-medium"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    onDisconnect();
    toast.success(`${walletName} Disconnected`, {
      description: `Successfully disconnected from your ${walletName} wallet.`,
      duration: 4000,
      className: "text-base font-medium"
    });
  };

  // walletName is determined dynamically based on available EIP-6963 providers

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6 bg-slate-50/50 rounded-xl border border-border/50 backdrop-blur-sm">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
        <div className="relative rounded-full bg-gradient-to-br from-primary/10 to-primary/5 p-4 ring-1 ring-primary/20">
          {walletType === "xverse" ? (
            <Image
              src="/xverse-logo.svg"
              alt="Xverse"
              width={32}
              height={32}
              priority
            />
          ) : walletIcon ? (
            <Image
              src={walletIcon}
              alt={walletName}
              width={32}
              height={32}
              priority
              unoptimized={!walletIcon.startsWith('/')}
            />
          ) : (
            <Image
              src="/metamask-logo.svg"
              alt={walletName}
              width={32}
              height={32}
              priority
            />
          )}
        </div>
      </div>
      
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">Connect {walletName}</h3>
        <p className="text-sm text-muted-foreground max-w-[280px]">
          {walletType === "xverse"
            ? "Xverse wallet connection is required to deposit BTC to VIA network"
            : `${walletName} wallet connection is required to withdraw BTC from VIA to Bitcoin network`}
        </p>
      </div>

      <Button
        onClick={isConnected ? handleDisconnect : handleConnect}
        variant={isConnected ? "outline" : "default"}
        className="w-full h-11 text-base font-medium shadow-sm hover:shadow-md transition-all duration-200"
        disabled={isConnecting}
      >
        {isConnecting ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Connecting...
          </>
        ) : isConnected ? (
          "Disconnect Wallet"
        ) : (
          `Connect ${walletName}`
        )}
      </Button>
    </div>
  );
}
