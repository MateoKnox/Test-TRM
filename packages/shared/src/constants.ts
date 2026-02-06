export const DEFAULT_BASE_SEPOLIA = {
  chainId: 84532,
  rpcUrl: 'https://sepolia.base.org',
  usdcAddress: '0x0000000000000000000000000000000000000000',
};

export const DEFAULT_BASE_MAINNET = {
  chainId: 8453,
  rpcUrl: 'https://mainnet.base.org',
  usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};

export const MESSAGE_TYPES = [
  'TASK_CREATED',
  'TASK_ACCEPTED',
  'TASK_SUBMITTED',
  'TASK_VERIFIED',
] as const;

export type MessageType = (typeof MESSAGE_TYPES)[number];
