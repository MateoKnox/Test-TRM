import * as dotenv from 'dotenv';
import { DEFAULT_BASE_MAINNET, DEFAULT_BASE_SEPOLIA } from '@clawhive/shared';

dotenv.config({ path: '../../.env' });

export type AppConfig = {
  privateKey: string;
  rpcUrl: string;
  chainId: number;
  usdcAddress: string;
  escrowAddress?: string;
  xmtpEnv: 'production' | 'dev';
};

export function readConfig(): AppConfig {
  const chainId = Number(process.env.CHAIN_ID || DEFAULT_BASE_SEPOLIA.chainId);
  const defaults =
    chainId === DEFAULT_BASE_MAINNET.chainId ? DEFAULT_BASE_MAINNET : DEFAULT_BASE_SEPOLIA;

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is required in .env');
  }

  return {
    privateKey,
    rpcUrl: process.env.RPC_URL || defaults.rpcUrl,
    chainId,
    usdcAddress: process.env.USDC_ADDRESS || defaults.usdcAddress,
    escrowAddress: process.env.ESCROW_ADDRESS,
    xmtpEnv: process.env.XMTP_ENV === 'dev' ? 'dev' : 'production',
  };
}
