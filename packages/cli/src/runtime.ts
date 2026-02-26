import { Contract, JsonRpcProvider, Wallet } from 'ethers';
import { ERC20_ABI, ESCROW_ABI } from './abi.js';
import { readConfig } from './config.js';

export function getRuntime() {
  const cfg = readConfig();
  const provider = new JsonRpcProvider(cfg.rpcUrl, cfg.chainId);
  const wallet = new Wallet(cfg.privateKey, provider);
  return { cfg, provider, wallet };
}

export function getEscrowContract() {
  const { cfg, wallet } = getRuntime();
  if (!cfg.escrowAddress) throw new Error('ESCROW_ADDRESS is required in .env');
  return new Contract(cfg.escrowAddress, ESCROW_ABI, wallet);
}

export function getUsdcContract(address?: string) {
  const { cfg, wallet } = getRuntime();
  const usdc = address || cfg.usdcAddress;
  if (!usdc || usdc === '0x0000000000000000000000000000000000000000') {
    throw new Error('USDC_ADDRESS is required in .env');
  }
  return new Contract(usdc, ERC20_ABI, wallet);
}
