import { useMemo } from "react";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import type { Account, Chain, Client, Transport } from "viem";
import { type Config, useConnectorClient } from "wagmi";

/**
 * Converts a viem Client to an ethers JsonRpcSigner.
 *
 * @param client - The viem client from wagmi's connector
 * @returns An ethers JsonRpcSigner for use with ethers.js contract calls
 */
export function clientToSigner(client: Client<Transport, Chain, Account>) {
  const { account, chain, transport } = client;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };

  const provider = new BrowserProvider(transport, network);
  return new JsonRpcSigner(provider, account.address);
}

/**
 * React hook that provides an ethers JsonRpcSigner from wagmi's connector client.
 *
 * @param options.chainId - Optional chain ID to get the signer for
 * @returns An ethers JsonRpcSigner, or undefined if no wallet is connected
 */
export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: client } = useConnectorClient<Config>({ chainId });
  return useMemo(() => (client ? clientToSigner(client) : undefined), [client]);
}