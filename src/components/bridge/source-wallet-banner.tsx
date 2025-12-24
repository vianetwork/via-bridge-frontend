// src/components/bridge/source-wallet-banner.tsx
"use client";

import { AlertTriangle, Wallet } from "lucide-react";

interface SourceWalletBannerProps {
  /** Type of wallet needed for the source */
  walletType: "bitcoin" | "evm";
  /** Whether the source wallet is connected */
  isConnected: boolean;
  /** Whether the source wallet is on the correct network */
  isCorrectNetwork: boolean;
  /** Callback to connect the source wallet */
  onConnect: () => void;
}

/**
 * SourceWalletBanner
 *
 * Displays a prompt to connect or switch the network of the source wallet
 *
 * States:
 * - Not connected: Orange banner with connected button
 * - Connected but wrong network: Amber banner with switch network button/message
 * - Connected and correct network: returns null (no banner shown)
 *
 * @example
 * ```tsx
 * <SourceWalletBanner
 *   walletType="bitcoin"
 *   isConnected={false}
 *   isCorrectNetwork={false}
 *   onConnect={handleConnect}
 * />
 * ```
 */
export function SourceWalletBanner({walletType, isConnected, isCorrectNetwork, onConnect,}: SourceWalletBannerProps) {
  // Don't render if the wallet is ready
  if (isConnected && isCorrectNetwork) return null;

  const walletLabel = walletType === "bitcoin" ? "Bitcoin" : "EVM";
  const connectButtonLabel = walletType === "bitcoin" ? "Connect Xverse" : "Connect Wallet";

  // Not connected state
  if (!isConnected) {
    return (
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-xl px-4 py-3.5 shadow-md mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-200 rounded-full flex items-center justify-center flex-shrink-0">
              <Wallet className="w-5 h-5 text-orange-700" strokeWidth={2} />
            </div>
            <div>
              <div className="font-semibold text-sm text-orange-900 mb-0.5">
                {walletLabel} Wallet Required
              </div>
              <div className="text-xs text-orange-700">
                Connect your {walletLabel} wallet to sign and send the transaction
              </div>
            </div>
          </div>
          <button
            type="button"
            className="px-4 py-2.5 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-700 shadow-sm transition-colors"
            onClick={onConnect}
          >
            {connectButtonLabel}
          </button>
        </div>
      </div>
    );
  }

  // Connected but wrong network state
  return (
    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl px-4 py-3.5 shadow-md mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-700" strokeWidth={2} />
        </div>
        <div>
          <div className="font-semibold text-sm text-amber-900 mb-0.5">
            Wrong Network Detected
          </div>
          <div className="text-xs text-amber-700">
            Switch your {walletLabel} wallet to the correct network to continue
          </div>
        </div>
      </div>
    </div>
  );
}
