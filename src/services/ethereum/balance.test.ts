/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getERC20Balance } from "./balance";

// Mock ethers module
vi.mock("ethers", () => ({
  BrowserProvider: vi.fn(),
  Contract: vi.fn(),
  formatUnits: vi.fn(),
}));

// Mock the contract utility
vi.mock("./contract", () => ({
  isContractDeployed: vi.fn(),
}));

// Mock the abis module
vi.mock("./abis", () => ({
  ERC20_ABI: [],
}));

describe("getERC20Balance", () => {
  const mockTokenAddress = "0x327d741E500E11Ab69F9D1A496A0ab4F934fA463";
  const mockWalletAddress = "0x1234567890123456789012345678901234567890";
  const mockDecimals = 6;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.ethereum using vi.stubGlobal
    vi.stubGlobal("ethereum", {});
  });

  afterEach(() => {
    // Restore all stubbed globals
    vi.unstubAllGlobals();
  });

  it("returns null when no ethereum provider is available", async () => {
    // Remove ethereum provider
    vi.stubGlobal("ethereum", undefined);

    const result = await getERC20Balance(mockTokenAddress, mockWalletAddress, mockDecimals);

    expect(result.balance).toBeNull();
    expect(result.error).toBe("No ethereum provider");
  });

  it("returns null when no contract exists at address", async () => {
    const { isContractDeployed } = await import("./contract");
    vi.mocked(isContractDeployed).mockResolvedValue(false);

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await getERC20Balance(mockTokenAddress, mockWalletAddress, mockDecimals);

    expect(isContractDeployed).toHaveBeenCalledWith(mockTokenAddress);
    expect(result.balance).toBeNull();
    expect(result.error).toBe("Contract does not exist");
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("No contract deployed"));

    warnSpy.mockRestore();
  });

  it("fetches balance successfully when contract exists", async () => {
    const { isContractDeployed } = await import("./contract");
    const { BrowserProvider, Contract, formatUnits } = await import("ethers");

    vi.mocked(isContractDeployed).mockResolvedValue(true);

    const mockBalanceOf = vi.fn().mockResolvedValue(BigInt("1000000")); // 1 USDC
    const mockProvider = {};
    const mockContract = { balanceOf: mockBalanceOf };

    vi.mocked(BrowserProvider).mockImplementation(
      () => mockProvider as unknown as InstanceType<typeof BrowserProvider>
    );
    vi.mocked(Contract).mockImplementation(
      () => mockContract as unknown as InstanceType<typeof Contract>
    );
    vi.mocked(formatUnits).mockReturnValue("1.0");

    const result = await getERC20Balance(mockTokenAddress, mockWalletAddress, mockDecimals);

    expect(isContractDeployed).toHaveBeenCalledWith(mockTokenAddress);
    expect(mockBalanceOf).toHaveBeenCalledWith(mockWalletAddress);
    expect(result.balance).toBe("1.0");
    expect(result.error).toBeNull();
  });

  it("handles BAD_DATA error gracefully", async () => {
    const { isContractDeployed } = await import("./contract");
    const { BrowserProvider, Contract } = await import("ethers");

    vi.mocked(isContractDeployed).mockResolvedValue(true);

    const mockBalanceOf = vi.fn().mockRejectedValue(
      new Error('could not decode result data (value="0x", code=BAD_DATA)')
    );
    const mockProvider = {};
    const mockContract = { balanceOf: mockBalanceOf };

    vi.mocked(BrowserProvider).mockImplementation(
      () => mockProvider as unknown as InstanceType<typeof BrowserProvider>
    );
    vi.mocked(Contract).mockImplementation(
      () => mockContract as unknown as InstanceType<typeof Contract>
    );

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await getERC20Balance(mockTokenAddress, mockWalletAddress, mockDecimals);

    expect(result.balance).toBeNull();
    expect(result.error).toBe("Contract does not implement balanceOf");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("may not implement balanceOf")
    );

    warnSpy.mockRestore();
  });

  it("handles generic errors gracefully", async () => {
    const { isContractDeployed } = await import("./contract");
    const { BrowserProvider, Contract } = await import("ethers");

    vi.mocked(isContractDeployed).mockResolvedValue(true);

    const mockBalanceOf = vi.fn().mockRejectedValue(new Error("Network error"));
    const mockProvider = {};
    const mockContract = { balanceOf: mockBalanceOf };

    vi.mocked(BrowserProvider).mockImplementation(
      () => mockProvider as unknown as InstanceType<typeof BrowserProvider>
    );
    vi.mocked(Contract).mockImplementation(
      () => mockContract as unknown as InstanceType<typeof Contract>
    );

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await getERC20Balance(mockTokenAddress, mockWalletAddress, mockDecimals);

    expect(result.balance).toBeNull();
    expect(result.error).toBe("Network error");
    expect(errorSpy).toHaveBeenCalledWith("Error fetching balance:", expect.any(Error));

    errorSpy.mockRestore();
  });
});
