"use client";

import Image from "next/image";
import Link from "next/link";
import { useWalletState } from "@/hooks/use-wallet-state";
import { Button } from "@/components/ui/button";
import { LogOut, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Layer } from "@/services/config";

export default function Header() {
  const {
    isXverseConnected,
    isMetamaskConnected,
    bitcoinAddress,
    viaAddress,
    disconnectXverse,
    disconnectMetamask,
    connectXverse,
    connectMetamask,
    isCorrectBitcoinNetwork,
    isCorrectViaNetwork,
    switchNetwork
  } = useWalletState();

  const [isConnecting, setIsConnecting] = useState(false);

  // Listen for account changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          // MetaMask is locked or the user has not connected any accounts
          console.log('Please connect to MetaMask.');
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  const handleConnectXverse = async () => {
    try {
      setIsConnecting(true);
      const connected = await connectXverse();
      if (connected) {
        toast.success("Xverse Connected", {
          description: "Successfully connected to your Xverse wallet.",
          duration: 4000
        });
      }
    } catch (error) {
      console.error("Xverse connection error:", error);
      toast.error("Connection Failed", {
        description: "Unable to connect to Xverse. Please try again.",
        duration: 4000
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnectMetamask = async () => {
    try {
      setIsConnecting(true);
      const connected = await connectMetamask();
      if (connected) {
        toast.success("MetaMask Connected", {
          description: "Successfully connected to your MetaMask wallet.",
          duration: 4000
        });
      }
    } catch (error) {
      console.error("MetaMask connection error:", error);
      toast.error("Connection Failed", {
        description: "Unable to connect to MetaMask. Please try again.",
        duration: 4000
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectXverse = () => {
    disconnectXverse();
    toast.success("Xverse Disconnected", {
      description: "Successfully disconnected from your Xverse wallet.",
      duration: 4000
    });
  };

  const handleDisconnectMetamask = () => {
    disconnectMetamask();
    toast.success("MetaMask Disconnected", {
      description: "Successfully disconnected from your MetaMask wallet.",
      duration: 4000
    });
  };

  const handleSwitchNetwork = (layer: Layer) => {
    switchNetwork(layer);
  };

  return (
    <header className="w-full py-4 px-6 bg-white border-b border-slate-200">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/icon.png"
              alt="VIA Bridge"
              width={32}
              height={32}
              priority
            />
            <span className="text-xl font-bold">VIA Bridge</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {isXverseConnected ? (
            <div className="flex items-center gap-2 text-sm bg-slate-100 px-3 py-1.5 rounded-full">
              <div
                className={`w-2 h-2 ${isCorrectBitcoinNetwork ? 'bg-green-500' : 'bg-amber-500'} rounded-full`}
                title={isCorrectBitcoinNetwork ? "Connected to correct network" : "Wrong network"}
              ></div>
              <span className="font-medium">BTC: {bitcoinAddress?.slice(0, 6)}...{bitcoinAddress?.slice(-4)}</span>
              {!isCorrectBitcoinNetwork && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-amber-500 hover:text-amber-700"
                  onClick={() => handleSwitchNetwork(Layer.L1)}
                  title="Switch to correct network"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-1 text-slate-500 hover:text-slate-700"
                onClick={handleDisconnectXverse}
                title="Disconnect Xverse"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleConnectXverse}
              disabled={isConnecting}
            >
              Connect Xverse
            </Button>
          )}

          {isMetamaskConnected ? (
            <div className="flex items-center gap-2 text-sm bg-slate-100 px-3 py-1.5 rounded-full">
              <div
                className={`w-2 h-2 ${isCorrectViaNetwork ? 'bg-green-500' : 'bg-amber-500'} rounded-full`}
                title={isCorrectViaNetwork ? "Connected to correct network" : "Wrong network"}
              ></div>
              <span className="font-medium">VIA: {viaAddress?.slice(0, 6)}...{viaAddress?.slice(-4)}</span>
              {!isCorrectViaNetwork && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-amber-500 hover:text-amber-700"
                  onClick={() => handleSwitchNetwork(Layer.L2)}
                  title="Switch to correct network"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 ml-1 text-slate-500 hover:text-slate-700"
                onClick={handleDisconnectMetamask}
                title="Disconnect MetaMask"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={handleConnectMetamask}
              disabled={isConnecting}
            >
              Connect MetaMask
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
