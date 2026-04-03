const assert = require("node:assert/strict");

const { ethers } = require("hardhat");

describe("SQMUCrowdfund", function () {
  const GOVERNANCE_ID = 0n;
  const GOVERNANCE_PRICE = ethers.parseUnits("100", 18);

  let owner;
  let buyer;
  let other;
  let paymentToken;
  let altToken;
  let sqmu;
  let crowdfund;

  async function deployProxy(factory, initArgs) {
    const implementation = await factory.deploy();
    const initData = factory.interface.encodeFunctionData("initialize", initArgs);
    const Proxy = await ethers.getContractFactory("TestERC1967Proxy");
    const proxy = await Proxy.deploy(await implementation.getAddress(), initData);
    return factory.attach(await proxy.getAddress());
  }

  beforeEach(async function () {
    [owner, buyer, other] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    paymentToken = await MockERC20.deploy("USD Coin", "USDC");
    altToken = await MockERC20.deploy("Tether", "USDT");

    const SQMU = await ethers.getContractFactory("SQMU");
    sqmu = await deployProxy(SQMU, [
      "ipfs://sqmu/{id}.json",
      "SQMU",
      "SQMU",
      owner.address
    ]);

    const SQMUCrowdfund = await ethers.getContractFactory("SQMUCrowdfund");
    crowdfund = await deployProxy(SQMUCrowdfund, [
      await sqmu.getAddress(),
      GOVERNANCE_PRICE
    ]);

    await sqmu.mint(await crowdfund.getAddress(), GOVERNANCE_ID, 50n, "0x");
  });

  it("initializes once and tracks only the active payment token allowlist", async function () {
    await assert.rejects(
      crowdfund.initialize(await sqmu.getAddress(), GOVERNANCE_PRICE)
    );

    assert.equal(await crowdfund.isAllowedToken(await paymentToken.getAddress()), false);

    await crowdfund.allowPaymentToken(await paymentToken.getAddress(), true);

    assert.equal(await crowdfund.isAllowedToken(await paymentToken.getAddress()), true);
    assert.deepEqual(
      Array.from(await crowdfund.getPaymentTokens()),
      [await paymentToken.getAddress()]
    );

    await crowdfund.allowPaymentToken(await paymentToken.getAddress(), false);

    assert.equal(await crowdfund.isAllowedToken(await paymentToken.getAddress()), false);
    assert.deepEqual(
      Array.from(await crowdfund.getPaymentTokens()),
      []
    );

    await crowdfund.allowPaymentToken(await paymentToken.getAddress(), true);

    assert.deepEqual(
      Array.from(await crowdfund.getPaymentTokens()),
      [await paymentToken.getAddress()]
    );
  });

  it("blocks purchases for disallowed payment tokens", async function () {
    await paymentToken.mint(buyer.address, GOVERNANCE_PRICE);
    await paymentToken.connect(buyer).approve(await crowdfund.getAddress(), GOVERNANCE_PRICE);

    await assert.rejects(
      crowdfund.connect(buyer).buy(await paymentToken.getAddress(), 1n),
      /Token not allowed/
    );
  });

  it("accepts an allowed payment token and transfers governance inventory", async function () {
    const expectedTotal = GOVERNANCE_PRICE * 2n;

    await crowdfund.allowPaymentToken(await paymentToken.getAddress(), true);
    await paymentToken.mint(buyer.address, expectedTotal);
    await paymentToken.connect(buyer).approve(await crowdfund.getAddress(), expectedTotal);

    await crowdfund.connect(buyer).buy(await paymentToken.getAddress(), 2n);

    assert.equal(
      await sqmu.balanceOf(buyer.address, GOVERNANCE_ID),
      2n
    );
    assert.equal(
      await sqmu.balanceOf(await crowdfund.getAddress(), GOVERNANCE_ID),
      48n
    );
    assert.equal(
      await paymentToken.balanceOf(await crowdfund.getAddress()),
      expectedTotal
    );

    await assert.rejects(
      crowdfund.connect(buyer).buy(await altToken.getAddress(), 1n),
      /Token not allowed/
    );
  });
});
