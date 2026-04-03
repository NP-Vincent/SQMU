const assert = require("node:assert/strict");

const { ethers } = require("hardhat");
const { deployProxy } = require("./helpers.cjs");

describe("SQMURentDistribution", function () {
  let owner;
  let depositor;
  let holderA;
  let holderB;
  let paymentToken;
  let sqmu;
  let vault;

  beforeEach(async function () {
    [owner, depositor, holderA, holderB] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    paymentToken = await MockERC20.deploy("USD Coin", "USDC");

    const SQMU = await ethers.getContractFactory("SQMU");
    sqmu = await deployProxy(SQMU, [
      "ipfs://sqmu/{id}.json",
      "SQMU",
      "SQMU",
      owner.address
    ]);

    const SQMURentDistribution = await ethers.getContractFactory("SQMURentDistribution");
    vault = await deployProxy(SQMURentDistribution, []);
  });

  it("initializes once and distributes deposited rent to holders", async function () {
    const depositAmount = ethers.parseUnits("100", 18);

    await assert.rejects(vault.initialize());

    await paymentToken.mint(depositor.address, depositAmount);
    await paymentToken.connect(depositor).approve(await vault.getAddress(), depositAmount);
    await vault.connect(depositor).depositRent(1n, await paymentToken.getAddress(), depositAmount);

    assert.equal(
      await vault.rentBalances(1n, await paymentToken.getAddress()),
      depositAmount
    );

    await assert.rejects(
      vault.connect(depositor).distribute(
        1n,
        await paymentToken.getAddress(),
        [holderA.address],
        [depositAmount]
      )
    );

    await vault.distribute(
      1n,
      await paymentToken.getAddress(),
      [holderA.address, holderB.address],
      [ethers.parseUnits("30", 18), ethers.parseUnits("70", 18)]
    );

    assert.equal(await paymentToken.balanceOf(holderA.address), ethers.parseUnits("30", 18));
    assert.equal(await paymentToken.balanceOf(holderB.address), ethers.parseUnits("70", 18));
    assert.equal(await vault.rentBalances(1n, await paymentToken.getAddress()), 0n);
  });

  it("can custody ERC-1155 tokens for deposit and owner withdrawal", async function () {
    await sqmu.mint(depositor.address, 9n, 3n, "0x");
    await sqmu.connect(depositor).setApprovalForAll(await vault.getAddress(), true);

    await vault.connect(depositor).depositNFT(await sqmu.getAddress(), 9n, 3n, "0x");

    assert.equal(await sqmu.balanceOf(await vault.getAddress(), 9n), 3n);

    await vault.withdrawNFT(await sqmu.getAddress(), 9n, 2n, holderA.address);

    assert.equal(await sqmu.balanceOf(holderA.address, 9n), 2n);
    assert.equal(await sqmu.balanceOf(await vault.getAddress(), 9n), 1n);
  });
});
