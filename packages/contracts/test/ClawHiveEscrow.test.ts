import { expect } from 'chai';
import fc from 'fast-check';
import { ethers } from 'hardhat';

describe('ClawHiveEscrow', function () {
  const BUDGET = ethers.parseUnits('10', 6);
  const ONE_DAY = 24 * 60 * 60;

  async function deployFixture() {
    const [requester, worker, verifier, other] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory('MockUSDC');
    const usdc = (await MockUSDC.deploy()) as any;
    await usdc.waitForDeployment();

    const Escrow = await ethers.getContractFactory('ClawHiveEscrow');
    const escrow = (await Escrow.deploy(await usdc.getAddress(), ONE_DAY)) as any;
    await escrow.waitForDeployment();

    await usdc.mint(requester.address, ethers.parseUnits('1000', 6));

    return { requester, worker, verifier, other, usdc, escrow };
  }

  async function createDefaultTask() {
    const { requester, worker, verifier, usdc, escrow } = await deployFixture();
    const [, , , other] = await ethers.getSigners();

    const latest = await ethers.provider.getBlock('latest');
    const deadline = (latest?.timestamp ?? 0) + ONE_DAY;

    await usdc.connect(requester).approve(await escrow.getAddress(), BUDGET);
    await escrow
      .connect(requester)
      .createTask(BUDGET, deadline, verifier.address, 500, ethers.id('meta'));

    return { requester, worker, verifier, other, usdc, escrow, deadline };
  }

  it('creates task and locks USDC', async function () {
    const { requester, verifier, usdc, escrow } = await deployFixture();
    const latest = await ethers.provider.getBlock('latest');
    const deadline = (latest?.timestamp ?? 0) + ONE_DAY;

    await usdc.connect(requester).approve(await escrow.getAddress(), BUDGET);

    await expect(
      escrow
        .connect(requester)
        .createTask(BUDGET, deadline, verifier.address, 250, ethers.id('meta')),
    )
      .to.emit(escrow, 'TaskCreated')
      .withArgs(1n, requester.address, BUDGET, deadline, verifier.address, 250n, ethers.id('meta'));

    expect(await usdc.balanceOf(await escrow.getAddress())).to.equal(BUDGET);
  });

  it('supports Open -> Accepted -> Submitted -> Verified -> Paid', async function () {
    const { requester, worker, verifier, usdc, escrow } = await createDefaultTask();

    await escrow.connect(worker).acceptTask(1);
    await escrow.connect(worker).submitWork(1, ethers.id('submission'), 'file:///tmp/work.txt');
    await escrow.connect(verifier).verifyWork(1, true, ethers.id('ok'));

    const workerBefore = await usdc.balanceOf(worker.address);
    const verifierBefore = await usdc.balanceOf(verifier.address);

    await escrow.connect(requester).releasePayment(1);

    const workerAfter = await usdc.balanceOf(worker.address);
    const verifierAfter = await usdc.balanceOf(verifier.address);

    const verifierFee = (BUDGET * 500n) / 10_000n;
    expect(workerAfter - workerBefore).to.equal(BUDGET - verifierFee);
    expect(verifierAfter - verifierBefore).to.equal(verifierFee);
  });

  it('supports Open -> Cancelled', async function () {
    const { requester, usdc, escrow } = await createDefaultTask();

    const before = await usdc.balanceOf(requester.address);
    await escrow.connect(requester).cancelTask(1);
    const after = await usdc.balanceOf(requester.address);

    expect(after - before).to.equal(BUDGET);
  });

  it('supports timeout reclaim path', async function () {
    const { requester, worker, usdc, escrow } = await createDefaultTask();

    await escrow.connect(worker).acceptTask(1);
    await escrow.connect(worker).submitWork(1, ethers.id('submission'), 'file:///tmp/work.txt');

    await ethers.provider.send('evm_increaseTime', [2 * ONE_DAY + 1]);
    await ethers.provider.send('evm_mine', []);

    const before = await usdc.balanceOf(requester.address);
    await escrow.connect(requester).reclaimAfterTimeout(1);
    const after = await usdc.balanceOf(requester.address);

    expect(after - before).to.equal(BUDGET);
  });

  it('prevents double accept / double submit / double pay', async function () {
    const { requester, worker, verifier, other, escrow } = await createDefaultTask();

    await escrow.connect(worker).acceptTask(1);
    await expect(escrow.connect(other).acceptTask(1)).to.be.revertedWith('not open');

    await escrow.connect(worker).submitWork(1, ethers.id('submission'), 'file:///tmp/work.txt');
    await expect(
      escrow.connect(worker).submitWork(1, ethers.id('submission2'), 'file:///tmp/work2.txt'),
    ).to.be.revertedWith('not accepted');

    await escrow.connect(verifier).verifyWork(1, true, ethers.id('ok'));
    await escrow.connect(requester).releasePayment(1);
    await expect(escrow.connect(requester).releasePayment(1)).to.be.revertedWith('not verified');
  });

  it('fuzz: sum payouts never exceeds budget', async function () {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1_000_000, max: 900_000_000 }),
        fc.integer({ min: 0, max: 10_000 }),
        async (budget, feeBps) => {
          const { requester, worker, verifier, usdc, escrow } = await deployFixture();
          const latest = await ethers.provider.getBlock('latest');
          const deadline = (latest?.timestamp ?? 0) + ONE_DAY;

          await usdc.connect(requester).approve(await escrow.getAddress(), BigInt(budget));
          await escrow
            .connect(requester)
            .createTask(BigInt(budget), deadline, verifier.address, feeBps, ethers.id('meta'));

          await escrow.connect(worker).acceptTask(1);
          await escrow
            .connect(worker)
            .submitWork(1, ethers.id('submission'), 'file:///tmp/work.txt');
          await escrow.connect(verifier).verifyWork(1, true, ethers.id('ok'));

          const workerBefore = await usdc.balanceOf(worker.address);
          const verifierBefore = await usdc.balanceOf(verifier.address);

          await escrow.releasePayment(1);

          const workerDelta = (await usdc.balanceOf(worker.address)) - workerBefore;
          const verifierDelta = (await usdc.balanceOf(verifier.address)) - verifierBefore;

          expect(workerDelta + verifierDelta).to.be.lte(BigInt(budget));
        },
      ),
      { numRuns: 20 },
    );
  });
});
