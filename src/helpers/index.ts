import { ethers } from "ethers";

const DIVISOR = 10_000_000_000;

export const toL1Amount = (amount: string): number => {
  const str = (amount ?? "").trim(); // remove spaces
  if (!str) return 0;
  try{
    return Number((ethers.parseEther(str) / BigInt(DIVISOR)).toString());
  } catch  {
    // invalid numbers (e.g, just a dot, too many decimals, letters, etc.)
    return 0;
  }
}; 