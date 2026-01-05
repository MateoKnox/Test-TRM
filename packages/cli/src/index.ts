#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { ethers } from 'ethers';
import { sha256Hex } from '@clawhive/shared';
import { deployEscrow, deployMockUsdc } from './deploy.js';
import { readConfig } from './config.js';
import { getEscrowContract, getRuntime, getUsdcContract } from './runtime.js';
import {
  ensureAllowance,
  parseVerdict,
  sha256FileHex,
  sha256TextHex,
  toFileUri,
  toUnits,
} from './utils.js';
import { xmtpListen, xmtpSend } from './xmtp.js';

const program = new Command();

program.name('clawhive').description('ClawHive CLI').version('0.1.0');

program
  .command('escrow:deploy')
  .option('--mock-usdc', 'deploy MockUSDC before escrow')
  .option('--grace <seconds>', 'grace period seconds', '86400')
  .action(async (opts) => {
    const { cfg, wallet } = getRuntime();
    let usdcAddress = cfg.usdcAddress;

    if (
      opts.mockUsdc ||
      cfg.chainId === 31337 ||
      usdcAddress === '0x0000000000000000000000000000000000000000'
    ) {
      console.log('[deploy] Deploying MockUSDC...');
      usdcAddress = await deployMockUsdc(wallet);
      const mock = getUsdcContract(usdcAddress);
      const mintTx = await mock.mint(wallet.address, ethers.parseUnits('10000', 6));
      await mintTx.wait();
      console.log(`[deploy] MockUSDC: ${usdcAddress}`);
    }

    console.log('[deploy] Deploying ClawHiveEscrow...');
    const escrowAddress = await deployEscrow(wallet, usdcAddress, Number(opts.grace));

    console.log('--- Deployment Complete ---');
    console.log(`CHAIN_ID=${cfg.chainId}`);
    console.log(`USDC_ADDRESS=${usdcAddress}`);
    console.log(`ESCROW_ADDRESS=${escrowAddress}`);
  });

program
  .command('task:create')
  .requiredOption('--budget <amount>', 'budget amount in USDC units, e.g. 1.5')
  .requiredOption('--deadline <iso>', 'deadline ISO timestamp')
  .requiredOption('--verifier <address>', 'verifier address')
  .requiredOption('--meta <path>', 'metadata json path')
  .option('--feeBps <bps>', 'verifier fee bps', '0')
  .action(async (opts) => {
    const escrow = getEscrowContract();
    const usdc = getUsdcContract();
    const { wallet } = getRuntime();

    const decimals = Number(await usdc.decimals());
    const budget = toUnits(opts.budget, decimals);
    const deadline = Math.floor(new Date(opts.deadline).getTime() / 1000);

    const metaRaw = readFileSync(resolve(opts.meta), 'utf8');
    const metadataHash = sha256Hex(metaRaw);

    await ensureAllowance(usdc, wallet.address, await escrow.getAddress(), budget);

    const tx = await escrow.createTask(
      budget,
      deadline,
      opts.verifier,
      Number(opts.feeBps),
      metadataHash,
    );
    const rc = await tx.wait();
    console.log(`[task:create] tx=${rc?.hash}`);
  });

program.command('task:list').action(async () => {
  const escrow = getEscrowContract();
  const count = Number(await escrow.taskCount());
  console.log(`tasks=${count}`);
  for (let i = 1; i <= count; i += 1) {
    const t = await escrow.getTask(i);
    console.log(
      JSON.stringify(
        {
          id: i,
          requester: t.requester,
          worker: t.worker,
          verifier: t.verifier,
          budget: t.budget.toString(),
          deadline: Number(t.deadline),
          status: Number(t.status),
          submissionURI: t.submissionURI,
        },
        null,
        2,
      ),
    );
  }
});

program
  .command('task:accept')
  .requiredOption('--id <taskId>', 'task id')
  .action(async (opts) => {
    const escrow = getEscrowContract();
    const tx = await escrow.acceptTask(BigInt(opts.id));
    const rc = await tx.wait();
    console.log(`[task:accept] tx=${rc?.hash}`);
  });

program
  .command('task:submit')
  .requiredOption('--id <taskId>', 'task id')
  .requiredOption('--file <path>', 'submission file path')
  .action(async (opts) => {
    const escrow = getEscrowContract();
    const submissionHash = sha256FileHex(resolve(opts.file));
    const submissionURI = toFileUri(opts.file);
    const tx = await escrow.submitWork(BigInt(opts.id), submissionHash, submissionURI);
    const rc = await tx.wait();
    console.log(`[task:submit] hash=${submissionHash} uri=${submissionURI}`);
    console.log(`[task:submit] tx=${rc?.hash}`);
  });

program
  .command('task:verify')
  .requiredOption('--id <taskId>', 'task id')
  .requiredOption('--verdict <pass|fail>', 'verification verdict')
  .requiredOption('--note <note>', 'verifier note')
  .action(async (opts) => {
    const escrow = getEscrowContract();
    const verdict = parseVerdict(opts.verdict);
    const noteHash = sha256TextHex(opts.note);
    const tx = await escrow.verifyWork(BigInt(opts.id), verdict, noteHash);
    const rc = await tx.wait();
    console.log(`[task:verify] noteHash=${noteHash} tx=${rc?.hash}`);
  });

program
  .command('task:release')
  .requiredOption('--id <taskId>', 'task id')
  .action(async (opts) => {
    const escrow = getEscrowContract();
    const tx = await escrow.releasePayment(BigInt(opts.id));
    const rc = await tx.wait();
    console.log(`[task:release] tx=${rc?.hash}`);
  });

program
  .command('task:cancel')
  .requiredOption('--id <taskId>', 'task id')
  .action(async (opts) => {
    const escrow = getEscrowContract();
    const tx = await escrow.cancelTask(BigInt(opts.id));
    const rc = await tx.wait();
    console.log(`[task:cancel] tx=${rc?.hash}`);
  });

program
  .command('task:reclaim')
  .requiredOption('--id <taskId>', 'task id')
  .action(async (opts) => {
    const escrow = getEscrowContract();
    const tx = await escrow.reclaimAfterTimeout(BigInt(opts.id));
    const rc = await tx.wait();
    console.log(`[task:reclaim] tx=${rc?.hash}`);
  });

program
  .command('xmtp:send')
  .requiredOption('--to <address>', 'recipient wallet address')
  .requiredOption('--json <path>', 'json message file')
  .action(async (opts) => {
    const cfg = readConfig();
    const { wallet } = getRuntime();
    const jsonPayload = readFileSync(resolve(opts.json), 'utf8');
    await xmtpSend(wallet, cfg.xmtpEnv, opts.to, jsonPayload);
    console.log('[xmtp:send] message sent');
  });

program.command('xmtp:listen').action(async () => {
  const cfg = readConfig();
  const { wallet } = getRuntime();
  await xmtpListen(wallet, cfg.xmtpEnv);
});

program.command('demo:run').action(async () => {
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const requester = new ethers.Wallet(process.env.DEMO_REQUESTER_KEY || '', provider);
  const worker = new ethers.Wallet(process.env.DEMO_WORKER_KEY || '', provider);
  const verifier = new ethers.Wallet(process.env.DEMO_VERIFIER_KEY || '', provider);

  if (!requester.privateKey || !worker.privateKey || !verifier.privateKey) {
    throw new Error('DEMO_REQUESTER_KEY, DEMO_WORKER_KEY, DEMO_VERIFIER_KEY are required');
  }

  console.log('[demo] Deploying contracts...');
  const usdcAddress = await deployMockUsdc(requester);
  const escrowAddress = await deployEscrow(requester, usdcAddress);

  const usdcRequester = new ethers.Contract(
    usdcAddress,
    [
      'function mint(address,uint256)',
      'function approve(address,uint256)',
      'function balanceOf(address) view returns (uint256)',
    ],
    requester,
  );

  const escrowRequester = new ethers.Contract(
    escrowAddress,
    [
      'function createTask(uint256,uint256,address,uint256,bytes32) returns (uint256)',
      'function releasePayment(uint256)',
    ],
    requester,
  );
  const escrowWorker = new ethers.Contract(
    escrowAddress,
    ['function acceptTask(uint256)', 'function submitWork(uint256,bytes32,string)'],
    worker,
  );
  const escrowVerifier = new ethers.Contract(
    escrowAddress,
    ['function verifyWork(uint256,bool,bytes32)'],
    verifier,
  );

  await (await usdcRequester.mint(requester.address, ethers.parseUnits('100', 6))).wait();
  await (await usdcRequester.approve(escrowAddress, ethers.parseUnits('10', 6))).wait();

  const latest = await provider.getBlock('latest');
  const deadline = Number((latest?.timestamp ?? 0) + 3600);

  await (
    await escrowRequester.createTask(
      ethers.parseUnits('10', 6),
      deadline,
      verifier.address,
      500,
      sha256Hex('demo-meta'),
    )
  ).wait();
  await (await escrowWorker.acceptTask(1)).wait();
  await (await escrowWorker.submitWork(1, sha256Hex('demo-work'), 'file:///demo.txt')).wait();
  await (await escrowVerifier.verifyWork(1, true, sha256Hex('ok'))).wait();
  await (await escrowRequester.releasePayment(1)).wait();

  console.log('[demo] Success');
  console.log(`escrow=${escrowAddress}`);
  console.log(`usdc=${usdcAddress}`);
  console.log(`workerBalance=${await usdcRequester.balanceOf(worker.address)}`);
});

program.parseAsync(process.argv).catch((err) => {
  console.error(`[error] ${err.message}`);
  process.exit(1);
});
