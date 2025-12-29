"use client";

import Image from "next/image";
import Link from "next/link";
import { useWalletState } from "@/hooks/use-wallet-state";
import { Button } from "@/components/ui/button";
import { LogOut, AlertCircle, Menu, Droplet, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Layer } from "@/services/config";
import { getPreferredWeb3ProviderAsync } from "@/utils/ethereum-provider";
import { useMobile } from "@/hooks/use-mobile";
import { WalletConnectButton as EVMSelectorButton } from "@/components/wallets/connect-button";
import { env } from "@/lib/env";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";


export default function Header() {
  const { isMobile, mounted } = useMobile();
  const enableFaucet = env().NEXT_PUBLIC_ENABLE_FAUCET;
  const {
    isXverseConnected,
    isMetamaskConnected,
    bitcoinAddress,
    viaAddress,
    l1Address,
    disconnectXverse,
    disconnectMetamask,
    connectXverse,
    isCorrectBitcoinNetwork,
    isCorrectViaNetwork,
    isCorrectL1Network,
    switchNetwork
  } = useWalletState();

  const [isConnectingXverse, setIsConnectingXverse] = useState(false);
  // const [isConnectingMetaMask, setIsConnectingMetaMask] = useState(false);

  const handleConnectXverse = async () => {
    try {
      setIsConnectingXverse(true);
      const connected = await connectXverse();
      if (connected) {
        toast.success("Xverse Connected", {
          description: "Successfully connected to your Xverse wallet.",
          duration: 4000,
          dismissible: false,
        });
      }
    } catch (error) {
      console.error("Xverse connection error:", error);
      toast.error("Connection Failed", {
        description: "Unable to connect to Xverse. Please try again.",
        duration: 4000
      });
    } finally {
      setIsConnectingXverse(false);
    }
  };

  // const handleConnectMetamask = async () => {
  //   try {
  //     setIsConnectingMetaMask(true);
  //     const connected = await connectMetamask();
  //     if (connected) {
  //       const best = await getPreferredWeb3ProviderAsync();
  //       const displayName = best?.name ?? "Web3 Wallet";
  //       toast.success(`${displayName} Connected`, {
  //         description: `Successfully connected to your ${displayName} wallet.`,
  //         duration: 4000,
  //         dismissible: false,
  //       });
  //     }
  //   } catch (error) {
  //     console.error("Web3 wallet connection error:", error);
  //     const best = await getPreferredWeb3ProviderAsync();
  //     const displayName = best?.name ?? "Web3 Wallet";
  //     toast.error("Connection Failed", {
  //       description: `Unable to connect to ${displayName}. Please try again.`,
  //       duration: 4000
  //     });
  //   } finally {
  //     setIsConnectingMetaMask(false);
  //   }
  // };

  const handleDisconnectXverse = () => {
    disconnectXverse();
    toast.success("Xverse Disconnected", {
      description: "Successfully disconnected from your Xverse wallet.",
      duration: 4000,
      dismissible: false,
    });
  };

  const handleDisconnectMetamask = async () => {
    const best = await getPreferredWeb3ProviderAsync();
    const displayName = best?.name ?? "Web3 Wallet";
    disconnectMetamask();
    toast.success(`${displayName} Disconnected`, {
      description: `Successfully disconnected from your ${displayName} wallet.`,
      duration: 4000,
      dismissible: false,
    });
  };

  const handleSwitchNetwork = (layer: Layer) => {
    switchNetwork(layer);
  };

  // Wallet connection buttons for dropdown menu
  const renderWalletOptions = () => (
    <>
      <DropdownMenuLabel>Bitcoin Wallet</DropdownMenuLabel>
      {isXverseConnected ? (
        <>
          <DropdownMenuItem className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 ${isCorrectBitcoinNetwork ? 'bg-green-500' : 'bg-amber-500'} rounded-full`}></div>
              <span>BTC: {bitcoinAddress?.slice(0, 6)}...{bitcoinAddress?.slice(-4)}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-2 text-slate-500 hover:text-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                handleDisconnectXverse();
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuItem>
          {!isCorrectBitcoinNetwork && (
            <DropdownMenuItem
              onClick={() => handleSwitchNetwork(Layer.L1)}
              className="text-amber-600"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Switch to correct Bitcoin network
            </DropdownMenuItem>
          )}
        </>
      ) : (
        <DropdownMenuItem
          onClick={handleConnectXverse}
          disabled={isConnectingXverse}
        >
          {isConnectingXverse ? "Connecting..." : "Connect Xverse"}
        </DropdownMenuItem>
      )}

      <DropdownMenuSeparator />

      <DropdownMenuLabel>EVM Wallet</DropdownMenuLabel>
      {isMetamaskConnected ? (
        <>
          <DropdownMenuItem className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(() => {
                // Determine which network is active and show appropriate label
                const isOnSepolia = isCorrectL1Network;
                const isOnVia = isCorrectViaNetwork;
                const address = l1Address || viaAddress;
                const networkLabel = isOnSepolia ? "SEP" : isOnVia ? "VIA" : "EVM";
                const isActiveNetwork = isOnSepolia || isOnVia;
                
                return (
                  <>
                    <div className={`w-2 h-2 ${isActiveNetwork ? 'bg-green-500' : 'bg-amber-500'} rounded-full`}></div>
                    <span>{networkLabel}: {address?.slice(0, 6)}...{address?.slice(-4)}</span>
                  </>
                );
              })()}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-2 text-slate-500 hover:text-slate-700"
              onClick={(e) => {
                e.stopPropagation();
                handleDisconnectMetamask();
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuItem>
          {!isCorrectViaNetwork && !isCorrectL1Network && (
            <DropdownMenuItem
              onClick={() => handleSwitchNetwork(Layer.L2)}
              className="text-amber-600"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Switch to Via Network
            </DropdownMenuItem>
          )}
        </>
      ) : (
        <DropdownMenuItem asChild>
          <EVMSelectorButton />
        </DropdownMenuItem>
      )}
    </>
  );

  return (
    <header className="w-full py-3 px-1 md:py-4 md:px-6 bg-white border-b border-slate-200">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/via-logo-new.svg"
              alt="Via Bridge"
              width={28}
              height={28}
              priority
              className="md:w-8 md:h-8"
            />
            <span className="text-lg md:text-l font-bold">Via Bridge</span>
          </Link>
          <span className="text-[10px] md:text-xs font-semibold px-1.5 py-0.5 md:px-2 md:py-0.5 bg-orange-100 text-orange-800 rounded-md border border-orange-200">
            Alpha Testnet
          </span>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5 rounded-md hover:bg-slate-100"
              >
                Bridge
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem asChild>
                <Link href="/bitcoin-bridge">Bitcoin Bridge</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/ethereum-bridge">Ethereum Bridge</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {enableFaucet && (
            <Link
              href="/faucet"
              className="flex items-center gap-1 text font-medium text-slate-600 hover:text-slate-900 transition-colors border-2 border-blue-600 rounded-md px-2 py-1"
            >
              <Droplet className="w-4 h-4 text-blue-400" />
              VIA Testnet Faucet
            </Link>
          )}

          {!mounted ? (
            // Show desktop layout during SSR/hydration to prevent mismatch
            <div className="flex items-center gap-2">
              {isXverseConnected ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-2"
                  onClick={handleDisconnectXverse}
                >
                  <div className={`w-2 h-2 ${isCorrectBitcoinNetwork ? 'bg-green-500' : 'bg-amber-500'} rounded-full`}></div>
                  <span>BTC: {bitcoinAddress?.slice(0, 6)}...{bitcoinAddress?.slice(-4)}</span>
                </Button>
              ) : (
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleConnectXverse}
                  disabled={isConnectingXverse}
                >
                  {isConnectingXverse ? "Connecting..." : "Connect Xverse"}
                </Button>
              )}
              
              {isMetamaskConnected ? (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-2"
                  onClick={handleDisconnectMetamask}
                >
                  <div className={`w-2 h-2 ${isCorrectViaNetwork ? 'bg-green-500' : 'bg-amber-500'} rounded-full`}></div>
                  <span>VIA: {viaAddress?.slice(0, 6)}...{viaAddress?.slice(-4)}</span>
                </Button>
              ) : (
                <EVMSelectorButton />
              )}
            </div>
          ) : isMobile ? (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 flex items-center gap-1.5">
                    <Menu className="h-3.5 w-3.5" />
                    <span>Menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Navigation</DropdownMenuLabel>
                  <DropdownMenuItem asChild>
                    <Link href="/bitcoin-bridge">Bitcoin Bridge</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/ethereum-bridge">Ethereum Bridge</Link>
                  </DropdownMenuItem>
                  {(enableFaucet) && (
                    <DropdownMenuItem asChild>
                      <Link href="/faucet">Faucet</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {renderWalletOptions()}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {isXverseConnected ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={handleDisconnectXverse}
                >
                  <div className={`w-2 h-2 ${isCorrectBitcoinNetwork ? 'bg-green-500' : 'bg-amber-500'} rounded-full`}></div>
                  <span>BTC: {bitcoinAddress?.slice(0, 6)}...{bitcoinAddress?.slice(-4)}</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleConnectXverse}
                  disabled={isConnectingXverse}
                >
                  {isConnectingXverse ? "Connecting..." : "Connect Xverse"}
                </Button>
              )}

              {isMetamaskConnected ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={handleDisconnectMetamask}
                >
                  {(() => {
                    // Determine which network is active and show appropriate label
                    const isOnSepolia = isCorrectL1Network;
                    const isOnVia = isCorrectViaNetwork;
                    const address = l1Address || viaAddress;
                    const networkLabel = isOnSepolia ? "SEP" : isOnVia ? "VIA" : "EVM";
                    const isActiveNetwork = isOnSepolia || isOnVia;
                    
                    return (
                      <>
                        <div className={`w-2 h-2 ${isActiveNetwork ? 'bg-green-500' : 'bg-amber-500'} rounded-full`}></div>
                        <span>{networkLabel}: {address?.slice(0, 6)}...{address?.slice(-4)}</span>
                      </>
                    );
                  })()}
                </Button>
              ) : (
                <EVMSelectorButton />
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
