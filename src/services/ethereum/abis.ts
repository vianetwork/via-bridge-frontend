export const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
  "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)"
];

export const VAULT_ABI = [
  "function deposit(uint256 amount) external",
  "function depositWithBridge(uint256 amount, address recipient) external",
  "function withdraw(uint256 shares, address receiver) payable external",
  "function withdrawWithBridge(uint256 amount, address recipient) external",
  "function totalAssets() view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)"
];

export const BRIDGE_ABI = [
  "function claimWithdrawal(uint256 nonce, uint256 shares, address l1Receiver) external",
  "function withdrawalInfo(bytes32 messageHash) view returns (bool isClaimed, uint256 batchNumber)"
];

export const MESSAGE_MANAGER_ABI = [
  "function getMessageInfo(bytes32 payloadHash) view returns (bool status, address vault)"
];

export const MULTICALL_ABI = [
  "function multicall(tuple(address target, uint256 gasLimit, bytes callData)[] calls) returns (uint256 blockNumber, tuple(bool success, uint256 gasUsed, bytes returnData)[] returnData)"
];
