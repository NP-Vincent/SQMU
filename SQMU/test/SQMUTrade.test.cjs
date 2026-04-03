const assert = require("node:assert/strict");

const { ethers } = require("hardhat");
const { deployProxy } = require("./helpers.cjs");

describe("SQMUTrade", function () {
  let owner;
  let treasury;
  let seller;
  let buyer;
  let paymentToken;
  let sqmu;
  let trade;
  let priceDistributor;

  beforeEach(async function () {
    [owner, treasury, seller, buyer] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    paymentToken = await MockERC20.deploy("USD Coin", "USDC");

    const SQMU = await ethers.getContractFactory("SQMU");
    sqmu = await deployProxy(SQMU, [
      "ipfs://sqmu/{id}.json",
      "SQMU",
      "SQMU",
      owner.address
    ]);
    await sqmu.mint(seller.address, 11n, 4n, "0x");

    const MockPriceDistributor = await ethers.getContractFactory("MockPriceDistributor");
    priceDistributor = await MockPriceDistributor.deploy();
    await priceDistributor.setUnitPrice(10_000n);

    const SQMUTrade = await ethers.getContractFactory("SQMUTrade");
    trade = await deployProxy(SQMUTrade, [
      treasury.address,
      500n,
      await priceDistributor.getAddress()
    ]);

    await trade.allowPaymentToken(await paymentToken.getAddress(), true);
    await sqmu.connect(seller).setApprovalForAll(await trade.getAddress(), true);
  });

  it("initializes once and creates active listings", async function () {
    await trade.connect(seller).listToken("PROP-001", await sqmu.getAddress(), 11n, 4n);

    const listing = await trade.getListing(1n);
    assert.equal(listing.seller, seller.address);
    assert.equal(listing.propertyCode, "PROP-001");
    assert.equal(listing.amountListed, 4n);
    assert.equal(listing.active, true);

    const activeListings = await trade.getActiveListings();
    assert.equal(activeListings.length, 1);
    assert.equal(activeListings[0].listingId, 1n);

    await assert.rejects(
      trade.initialize(treasury.address, 100n, await priceDistributor.getAddress())
    );
  });

  it("buys listed tokens, splits commission, and returns leftovers on cancellation", async function () {
    const totalPrice = ethers.parseUnits("200", 18);
    const commission = ethers.parseUnits("10", 18);

    await trade.connect(seller).listToken("PROP-001", await sqmu.getAddress(), 11n, 4n);
    await paymentToken.mint(buyer.address, totalPrice);
    await paymentToken.connect(buyer).approve(await trade.getAddress(), totalPrice);

    await trade.connect(buyer).buy(1n, 2n, await paymentToken.getAddress());

    const listingAfterBuy = await trade.getListing(1n);
    assert.equal(listingAfterBuy.amountListed, 2n);
    assert.equal(listingAfterBuy.active, true);
    assert.equal(await sqmu.balanceOf(buyer.address, 11n), 2n);
    assert.equal(await paymentToken.balanceOf(treasury.address), commission);
    assert.equal(await paymentToken.balanceOf(seller.address), totalPrice - commission);

    await trade.connect(seller).cancelListing(1n);

    const cancelled = await trade.getListing(1n);
    assert.equal(cancelled.active, false);
    assert.equal(cancelled.amountListed, 0n);
    assert.equal(await sqmu.balanceOf(seller.address, 11n), 2n);
  });
});
