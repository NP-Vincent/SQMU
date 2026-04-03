const assert = require("node:assert/strict");

const { ethers } = require("hardhat");
const { deployProxy } = require("./helpers.cjs");

describe("SQMU", function () {
  let owner;
  let holder;
  let other;
  let sqmu;

  beforeEach(async function () {
    [owner, holder, other] = await ethers.getSigners();

    const SQMU = await ethers.getContractFactory("SQMU");
    sqmu = await deployProxy(SQMU, [
      "ipfs://sqmu/{id}.json",
      "SQMU",
      "SQMU",
      owner.address
    ]);
  });

  it("initializes once and exposes collection metadata", async function () {
    assert.equal(await sqmu.name(), "SQMU");
    assert.equal(await sqmu.symbol(), "SQMU");
    assert.equal(await sqmu.owner(), owner.address);
    assert.equal(await sqmu.uri(1n), "ipfs://sqmu/{id}.json");

    await assert.rejects(
      sqmu.initialize("ipfs://updated/{id}.json", "Updated", "UPD", owner.address)
    );
  });

  it("restricts minting to the owner and lets holders burn their balances", async function () {
    await sqmu.mint(holder.address, 1n, 5n, "0x");
    assert.equal(await sqmu.balanceOf(holder.address, 1n), 5n);

    await assert.rejects(
      sqmu.connect(holder).mint(holder.address, 1n, 1n, "0x")
    );

    await sqmu.mintBatch(holder.address, [2n, 3n], [7n, 9n], "0x");
    assert.equal(await sqmu.balanceOf(holder.address, 2n), 7n);
    assert.equal(await sqmu.balanceOf(holder.address, 3n), 9n);

    await sqmu.connect(holder).burn(holder.address, 1n, 2n);
    assert.equal(await sqmu.balanceOf(holder.address, 1n), 3n);

    await assert.rejects(
      sqmu.connect(other).burn(holder.address, 2n, 1n)
    );
  });
});
