import { ethers } from "ethers";

const DIVISOR = 10_000_000_000;

export const toL1Amount = (amount: string): number => {
    return Number((ethers.parseEther(amount) / BigInt(DIVISOR)).toString());
}; 