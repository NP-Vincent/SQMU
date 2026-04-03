const assert = require("node:assert/strict");

const { ethers } = require("hardhat");
const { deployProxy, increaseTime } = require("./helpers.cjs");

describe("SQMURent", function () {
  const PROPERTY_ID = 101n;
  const RENT_PERIOD = 30 * 24 * 60 * 60;
  const RENT_WINDOW = 7 * 24 * 60 * 60;

  let owner;
  let treasury;
  let tenant;
  let other;
  let paymentToken;
  let sqmu;
  let vault;
  let rent;

  beforeEach(async function () {
    [owner, treasury, tenant, other] = await ethers.getSigners();

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

    const SQMURent = await ethers.getContractFactory("SQMURent");
    rent = await deployProxy(SQMURent, [await vault.getAddress()]);

    await rent.setTreasury(treasury.address);
    await rent.setAcceptedToken(await paymentToken.getAddress(), true);
  });

  it("initializes once and handles deposit plus refund without leaking state", async function () {
    const depositAmount = ethers.parseUnits("50", 18);
    const refundAmount = ethers.parseUnits("30", 18);

    await assert.rejects(rent.initialize(await vault.getAddress()));

    await paymentToken.mint(tenant.address, depositAmount);
    await paymentToken.connect(tenant).approve(await rent.getAddress(), depositAmount);
    await rent.connect(tenant).payDeposit(PROPERTY_ID, await paymentToken.getAddress(), depositAmount);

    const [storedAmount, storedToken, storedTenant, contractBalance] =
      await rent.getDepositDetails(PROPERTY_ID);
    assert.equal(storedAmount, depositAmount);
    assert.equal(storedToken, await paymentToken.getAddress());
    assert.equal(storedTenant, tenant.address);
    assert.equal(contractBalance, depositAmount);

    await rent.refundDeposit(PROPERTY_ID, tenant.address, refundAmount);

    assert.equal(await paymentToken.balanceOf(tenant.address), refundAmount);
    assert.equal(await paymentToken.balanceOf(treasury.address), depositAmount - refundAmount);

    const rental = await rent.rentals(PROPERTY_ID);
    assert.equal(rental.occupied, false);
    assert.equal(rental.tenant, ethers.ZeroAddress);
  });

  it("collects rent into the vault while tracking and withdrawing only management fees", async function () {
    const depositAmount = ethers.parseUnits("50", 18);
    const rentAmount = ethers.parseUnits("100", 18);
    const feeAmount = ethers.parseUnits("10", 18);
    const netAmount = ethers.parseUnits("90", 18);

    await paymentToken.mint(tenant.address, depositAmount + rentAmount);
    await paymentToken.connect(tenant).approve(await rent.getAddress(), depositAmount + rentAmount);
    await rent.connect(tenant).payDeposit(PROPERTY_ID, await paymentToken.getAddress(), depositAmount);

    await increaseTime(RENT_PERIOD - RENT_WINDOW);
    await rent.connect(tenant).collectRent(PROPERTY_ID, await paymentToken.getAddress(), rentAmount);

    assert.equal(
      await vault.rentBalances(PROPERTY_ID, await paymentToken.getAddress()),
      netAmount
    );
    assert.equal(
      await rent.accruedManagementFees(await paymentToken.getAddress()),
      feeAmount
    );
    assert.equal(
      await paymentToken.balanceOf(await rent.getAddress()),
      depositAmount + feeAmount
    );

    await rent.withdrawManagementFees(await paymentToken.getAddress());

    assert.equal(await paymentToken.balanceOf(treasury.address), feeAmount);
    assert.equal(await rent.accruedManagementFees(await paymentToken.getAddress()), 0n);
    assert.equal(
      await paymentToken.balanceOf(await rent.getAddress()),
      depositAmount
    );
  });

  it("can custody ERC-1155 tokens for property operations", async function () {
    await sqmu.mint(other.address, 12n, 4n, "0x");
    await sqmu.connect(other).setApprovalForAll(await rent.getAddress(), true);

    await rent.connect(other).depositNFT(await sqmu.getAddress(), 12n, 4n, "0x");
    assert.equal(await sqmu.balanceOf(await rent.getAddress(), 12n), 4n);

    await rent.withdrawNFT(await sqmu.getAddress(), 12n, 1n, treasury.address);
    assert.equal(await sqmu.balanceOf(treasury.address, 12n), 1n);
    assert.equal(await sqmu.balanceOf(await rent.getAddress(), 12n), 3n);
  });
});
