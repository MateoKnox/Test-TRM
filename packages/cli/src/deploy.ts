import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ContractFactory, type Wallet } from 'ethers';

type Artifact = {
  abi: any[];
  bytecode: string;
};

function readArtifact(path: string): Artifact {
  const full = resolve(path);
  const json = JSON.parse(readFileSync(full, 'utf8'));
  if (!json.abi || !json.bytecode) {
    throw new Error(`Invalid artifact: ${full}`);
  }
  return { abi: json.abi, bytecode: json.bytecode };
}

export async function deployMockUsdc(wallet: Wallet): Promise<string> {
  const artifact = readArtifact('../contracts/artifacts/contracts/MockUSDC.sol/MockUSDC.json');
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  return await contract.getAddress();
}

export async function deployEscrow(
  wallet: Wallet,
  usdcAddress: string,
  gracePeriodSeconds = 24 * 60 * 60,
): Promise<string> {
  const artifact = readArtifact(
    '../contracts/artifacts/contracts/ClawHiveEscrow.sol/ClawHiveEscrow.json',
  );
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(usdcAddress, gracePeriodSeconds);
  await contract.waitForDeployment();
  return await contract.getAddress();
}
