import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ethers } from 'ethers';

export function sha256FileHex(path: string): `0x${string}` {
  const bytes = readFileSync(path);
  return `0x${createHash('sha256').update(bytes).digest('hex')}`;
}

export function sha256TextHex(text: string): `0x${string}` {
  return `0x${createHash('sha256').update(text).digest('hex')}`;
}

export function toFileUri(path: string): string {
  return `file://${resolve(path).replace(/\\/g, '/')}`;
}

export async function ensureAllowance(
  usdc: any,
  owner: string,
  spender: string,
  amount: bigint,
): Promise<void> {
  const allowance = (await usdc.allowance(owner, spender)) as bigint;
  if (allowance >= amount) return;
  const tx = await usdc.approve(spender, amount);
  await tx.wait();
}

export function parseVerdict(value: string): boolean {
  const v = value.toLowerCase();
  if (v === 'pass') return true;
  if (v === 'fail') return false;
  throw new Error("verdict must be 'pass' or 'fail'");
}

export function toUnits(amount: string, decimals: number): bigint {
  return ethers.parseUnits(amount, decimals);
}
