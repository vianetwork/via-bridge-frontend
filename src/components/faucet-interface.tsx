"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Droplets, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { requestFaucetFunds } from "@/services/api/faucet";
import { useWalletState } from "@/hooks/use-wallet-state";

interface FaucetRequest {
  address: string;
  txHash?: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
}

export default function FaucetInterface() {
  const { viaAddress } = useWalletState();
  const [faucetRequest, setFaucetRequest] = useState<FaucetRequest>({
    address: viaAddress || "",
    status: 'idle'
  });

  const handleAddressChange = (value: string) => {
    setFaucetRequest(prev => ({
      ...prev,
      address: value,
      status: 'idle',
      error: undefined
    }));
  };


  const handleUseConnectedWallet = () => {
    if (viaAddress) {
      setFaucetRequest(prev => ({
        ...prev,
        address: viaAddress,
        status: 'idle',
        error: undefined
      }));
    }
  };

  const handleRequestFunds = async () => {
    if (!faucetRequest.address.trim()) {
      setFaucetRequest(prev => ({
        ...prev,
        status: 'error',
        error: 'Please enter a valid VIA address'
      }));
      return;
    }

    setFaucetRequest(prev => ({ ...prev, status: 'loading' }));

    try {
      const result = await requestFaucetFunds(faucetRequest.address);
      
      if (result.success) {
        setFaucetRequest(prev => ({
          ...prev,
          status: 'success',
        }));
        toast.success("Faucet Request Successful", {
          description: `Successfully requested test BTC to ${faucetRequest.address.slice(0, 6)}...${faucetRequest.address.slice(-4)}`,
          duration: 5000
        });
      } else {
        setFaucetRequest(prev => ({
          ...prev,
          status: 'error',
          error: result.error || 'Failed to request funds from faucet'
        }));
        toast.error("Faucet Request Failed", {
          description: result.error || 'Failed to request funds from faucet',
          duration: 5000
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setFaucetRequest(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage
      }));
      toast.error("Faucet Request Failed", {
        description: errorMessage,
        duration: 5000
      });
    }
  };

  const isValidAddress = (address: string) => {
    return address.startsWith('0x') && address.length === 42;
  };

  return (
    <div className="w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-blue-500" />
            Request Test BTC
          </CardTitle>
          <CardDescription>
            Enter your VIA network wallet address to receive test BTC for development and testing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">VIA Address</Label>
            <div className="flex gap-2">
              <Input
                id="address"
                placeholder="0x..."
                value={faucetRequest.address}
                onChange={(e) => handleAddressChange(e.target.value)}
                className={!isValidAddress(faucetRequest.address) && faucetRequest.address ? 'border-red-500' : ''}
              />
              {viaAddress && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUseConnectedWallet}
                  className="whitespace-nowrap"
                >
                  Use Wallet Address
                </Button>
              )}
            </div>
            {faucetRequest.address && !isValidAddress(faucetRequest.address) && (
              <p className="text-sm text-red-500">Please enter a valid VIA address (0x...)</p>
            )}
          </div>

          {faucetRequest.status === 'error' && faucetRequest.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="flex-1">{faucetRequest.error}</AlertDescription>
            </Alert>
          )}

          {faucetRequest.status === 'success' && (
            <Alert>
              <CheckCircle className="h-4 w-4 flex-shrink-0" />
              <AlertDescription className="flex-1">
                <div className="space-y-2">
                  <p>Funds requested successfully!</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleRequestFunds}
            disabled={faucetRequest.status === 'loading' || !isValidAddress(faucetRequest.address)}
            className="w-full"
          >
            {faucetRequest.status === 'loading' ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Requesting Funds...
              </>
            ) : (
              <>
                Request Test BTC
              </>
            )}
          </Button>

          <div className="text-xs text-slate-500 space-y-1">
            <p>• Funds are distributed on testnet</p>
            <p>• Use responsibly for testing purposes only</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
