const assert = require("node:assert/strict");

const { ethers } = require("hardhat");
const { deployProxy } = require("./helpers.cjs");

describe("AtomicSQMUDistributor", function () {
  let owner;
  let treasury;
  let buyer;
  let agent;
  let receiver;
  let paymentToken;
  let sqmu;
  let distributor;

  beforeEach(async function () {
    [owner, treasury, buyer, agent, receiver] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    paymentToken = await MockERC20.deploy("USD Coin", "USDC");

    const SQMU = await ethers.getContractFactory("SQMU");
    sqmu = await deployProxy(SQMU, [
      "ipfs://sqmu/{id}.json",
      "SQMU",
      "SQMU",
      owner.address
    ]);

    const AtomicSQMUDistributor = await ethers.getContractFactory("AtomicSQMUDistributor");
    distributor = await deployProxy(AtomicSQMUDistributor, [500n]);

    await sqmu.mint(treasury.address, 1n, 20n, "0x");
    await sqmu.connect(treasury).setApprovalForAll(await distributor.getAddress(), true);

    await distributor.registerProperty(
      "PROP-001",
      "Residences",
      await sqmu.getAddress(),
      1n,
      treasury.address,
      ethers.parseUnits("100", 18),
      true
    );
    await distributor.registerAgent("AGENT-1", "Primary Agent", agent.address);
    await distributor.allowPaymentToken(await paymentToken.getAddress(), true);
  });

  it("initializes once and stores property, agent, and token configuration", async function () {
    const property = await distributor.getPropertyInfo("PROP-001");
    assert.equal(property.name, "Residences");
    assert.equal(property.treasury, treasury.address);
    assert.equal(property.active, true);

    const storedAgent = await distributor.getAgentInfo("AGENT-1");
    assert.equal(storedAgent.name, "Primary Agent");
    assert.equal(storedAgent.wallet, agent.address);
    assert.equal(storedAgent.registered, true);

    assert.equal(await distributor.isAllowedToken(await paymentToken.getAddress()), true);

    await assert.rejects(distributor.initialize(100n));
  });

  it("sells SQMU, pays agent commission, and supports manual distribution", async function () {
    const totalPrice = ethers.parseUnits("200", 18);
    const commission = ethers.parseUnits("10", 18);

    await paymentToken.mint(buyer.address, totalPrice);
    await paymentToken.connect(buyer).approve(await distributor.getAddress(), totalPrice);

    await distributor.connect(buyer).buySQMU(
      "PROP-001",
      2n,
      await paymentToken.getAddress(),
      "AGENT-1"
    );

    assert.equal(await sqmu.balanceOf(buyer.address, 1n), 2n);
    assert.equal(await paymentToken.balanceOf(agent.address), commission);
    assert.equal(
      await paymentToken.balanceOf(treasury.address),
      totalPrice - commission
    );

    await distributor.manualDistribute("PROP-001", receiver.address, 1n, "");
    assert.equal(await sqmu.balanceOf(receiver.address, 1n), 1n);
  });
});
