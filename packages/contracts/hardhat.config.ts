import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';
import type { HardhatUserConfig } from 'hardhat/config';

dotenv.config({ path: '../../.env' });

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    baseSepolia: {
      url: process.env.RPC_URL || 'https://sepolia.base.org',
      chainId: Number(process.env.CHAIN_ID || 84532),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    baseMainnet: {
      url: process.env.RPC_URL || 'https://mainnet.base.org',
      chainId: Number(process.env.CHAIN_ID || 8453),
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

export default config;
