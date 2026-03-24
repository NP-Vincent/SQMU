const assert = require("node:assert/strict");

const { ethers } = require("hardhat");

describe("EscrowFactory", function () {
  const Stage = {
    EOI: 0,
    Deposit: 1,
    Final: 2
  };

  const targets = {
    eoi: 100n,
    deposit: 200n,
    final: 300n
  };

  let owner;
  let buyer;
  let seller;
  let agent;
  let other;
  let token;
  let disallowedToken;
  let escrowImplementation;
  let factoryImplementation;
  let factory;

  async function deployFactoryFixture() {
    [owner, buyer, seller, agent, other] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy("USD Coin", "USDC");
    disallowedToken = await MockERC20.deploy("USDQ", "USDQ");

    const Escrow = await ethers.getContractFactory("Escrow");
    escrowImplementation = await Escrow.deploy();

    const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
    factoryImplementation = await EscrowFactory.deploy();

    const initData = EscrowFactory.interface.encodeFunctionData("initialize", [
      await escrowImplementation.getAddress(),
      owner.address
    ]);

    const TestERC1967Proxy = await ethers.getContractFactory("TestERC1967Proxy");
    const proxy = await TestERC1967Proxy.deploy(await factoryImplementation.getAddress(), initData);

    factory = EscrowFactory.attach(await proxy.getAddress());

    await factory.addAllowedToken(await token.getAddress());
  }

  async function createEscrow(caller = other, overrides = {}) {
    const propertyRef = overrides.propertyRef ?? ethers.encodeBytes32String("PROP-001");
    const deadline = overrides.deadline ?? (await latestTimestamp()) + 7 * 24 * 60 * 60;
    const eoiTarget = overrides.eoiTarget ?? targets.eoi;
    const depositTarget = overrides.depositTarget ?? targets.deposit;
    const finalTarget = overrides.finalTarget ?? targets.final;
    const buyerAddress = overrides.buyer ?? buyer.address;
    const sellerAddress = overrides.seller ?? seller.address;
    const agentAddress = overrides.agent ?? agent.address;
    const tokenAddress = overrides.token ?? (await token.getAddress());

    await factory
      .connect(caller)
      .createEscrow(
        buyerAddress,
        sellerAddress,
        agentAddress,
        tokenAddress,
        propertyRef,
        deadline,
        eoiTarget,
        depositTarget,
        finalTarget
      );

    const escrows = await factory.getEscrows();
    const escrowAddress = escrows[escrows.length - 1];
    const Escrow = await ethers.getContractFactory("Escrow");
    return Escrow.attach(escrowAddress);
  }

  async function latestTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return Number(block.timestamp);
  }

  beforeEach(async function () {
    await deployFactoryFixture();
  });

  it("initializes the UUPS proxy only once", async function () {
    await assert.rejects(
      factory.initialize(await escrowImplementation.getAddress(), owner.address)
    );
  });

  it("restricts upgrades to the factory owner", async function () {
    const FactoryV2 = await ethers.getContractFactory("EscrowFactoryV2Mock");
    const factoryV2 = await FactoryV2.deploy();

    await assert.rejects(
      factory.connect(other).upgradeToAndCall(await factoryV2.getAddress(), "0x")
    );

    await factory.upgradeToAndCall(await factoryV2.getAddress(), "0x");

    const upgraded = FactoryV2.attach(await factory.getAddress());
    assert.equal(await upgraded.version(), 2n);
  });

  it("creates public escrows for allowed tokens and indexes them", async function () {
    const escrow = await createEscrow(other);
    const escrowAddress = await escrow.getAddress();

    const allEscrows = await factory.getEscrows();
    assert.equal(allEscrows.length, 1);
    assert.equal(allEscrows[0], escrowAddress);

    const participantEscrows = await factory.getEscrowsByParticipant(buyer.address);
    assert.equal(participantEscrows.length, 1);
    assert.equal(participantEscrows[0], escrowAddress);

    const propertyEscrows = await factory.getEscrowsByProperty(ethers.encodeBytes32String("PROP-001"));
    assert.equal(propertyEscrows.length, 1);
    assert.equal(propertyEscrows[0], escrowAddress);

    const tokenEscrows = await factory.getEscrowsByToken(await token.getAddress());
    assert.equal(tokenEscrows.length, 1);
    assert.equal(tokenEscrows[0], escrowAddress);

    const record = await factory.escrowRecords(escrowAddress);
    assert.equal(record.buyer, buyer.address);
    assert.equal(record.seller, seller.address);
    assert.equal(record.agent, agent.address);
    assert.equal(record.token, await token.getAddress());
    assert.equal(record.propertyRef, ethers.encodeBytes32String("PROP-001"));
  });

  it("blocks creation when paused or when the token is not whitelisted", async function () {
    await factory.pause();
    await assert.rejects(createEscrow(other));
    await factory.unpause();

    await assert.rejects(
      createEscrow(other, {
        token: await disallowedToken.getAddress()
      })
    );
  });

  it("validates participant and target inputs during creation", async function () {
    await assert.rejects(
      createEscrow(other, {
        buyer: ethers.ZeroAddress
      })
    );

    await assert.rejects(
      createEscrow(other, {
        seller: buyer.address
      })
    );

    await assert.rejects(
      createEscrow(other, {
        propertyRef: ethers.ZeroHash
      })
    );

    await assert.rejects(
      createEscrow(other, {
        deadline: (await latestTimestamp()) - 1
      })
    );

    await assert.rejects(
      createEscrow(other, {
        eoiTarget: 0n
      })
    );
  });

  it("stores immutable escrow configuration and prevents reinitialization", async function () {
    const deadline = (await latestTimestamp()) + 30 * 24 * 60 * 60;
    const escrow = await createEscrow(other, { deadline });

    const [storedBuyer, storedSeller, storedAgent] = await escrow.getParticipants();
    assert.equal(storedBuyer, buyer.address);
    assert.equal(storedSeller, seller.address);
    assert.equal(storedAgent, agent.address);
    assert.equal(await escrow.factory(), await factory.getAddress());
    assert.equal(await escrow.paymentToken(), await token.getAddress());
    assert.equal(await escrow.propertyRef(), ethers.encodeBytes32String("PROP-001"));
    assert.equal(await escrow.deadline(), BigInt(deadline));

    const eoiDetails = await escrow.getStageDetails(Stage.EOI);
    assert.equal(eoiDetails.targetAmount, targets.eoi);
    assert.equal(eoiDetails.depositedAmount, 0n);
    assert.equal(eoiDetails.heldAmount, 0n);

    await assert.rejects(
      escrow.initialize(
        buyer.address,
        seller.address,
        agent.address,
        await token.getAddress(),
        ethers.encodeBytes32String("PROP-002"),
        deadline,
        1n,
        1n,
        1n
      )
    );
  });

  it("only lets the buyer deposit and enforces per-stage targets", async function () {
    const escrow = await createEscrow(other);
    const escrowAddress = await escrow.getAddress();

    await token.mint(buyer.address, 1_000n);
    await token.connect(buyer).approve(escrowAddress, 1_000n);

    await assert.rejects(escrow.connect(other).deposit(Stage.EOI, 10n));

    await escrow.connect(buyer).deposit(Stage.EOI, 40n);
    await escrow.connect(buyer).deposit(Stage.EOI, 60n);

    const eoiDetails = await escrow.getStageDetails(Stage.EOI);
    assert.equal(eoiDetails.depositedAmount, 100n);
    assert.equal(eoiDetails.heldAmount, 100n);

    await assert.rejects(escrow.connect(buyer).deposit(Stage.EOI, 1n));
    assert.equal(await escrow.currentState(), 1n);
  });

  it("allows stage release with 2-of-3 confirmations and settles only funded amounts", async function () {
    const escrow = await createEscrow(other);
    const escrowAddress = await escrow.getAddress();

    await token.mint(buyer.address, 1_000n);
    await token.connect(buyer).approve(escrowAddress, 1_000n);

    await escrow.connect(buyer).deposit(Stage.EOI, 40n);

    await escrow.connect(buyer).proposeRelease(Stage.EOI);
    const action = await escrow.getAction(1n);
    assert.equal(action.confirmationCount, 1n);
    assert.equal(action.buyerConfirmed, true);

    await assert.rejects(escrow.connect(buyer).confirmAction(1n));

    const sellerBalanceBefore = await token.balanceOf(seller.address);
    await escrow.connect(seller).confirmAction(1n);
    const sellerBalanceAfter = await token.balanceOf(seller.address);

    assert.equal(sellerBalanceAfter - sellerBalanceBefore, 40n);

    const eoiDetails = await escrow.getStageDetails(Stage.EOI);
    assert.equal(eoiDetails.heldAmount, 0n);
    assert.equal(eoiDetails.depositedAmount, 40n);
    assert.equal(eoiDetails.settlement, 1n);

    await assert.rejects(escrow.connect(buyer).proposeRelease(Stage.EOI));
  });

  it("allows refunds after expiry and moves the escrow into the cancelled path", async function () {
    const escrow = await createEscrow(other, {
      deadline: (await latestTimestamp()) + 100
    });
    const escrowAddress = await escrow.getAddress();

    await token.mint(buyer.address, 1_000n);
    await token.connect(buyer).approve(escrowAddress, 1_000n);
    await escrow.connect(buyer).deposit(Stage.Deposit, 125n);

    await ethers.provider.send("evm_setNextBlockTimestamp", [(await latestTimestamp()) + 200]);
    await ethers.provider.send("evm_mine");

    assert.equal(await escrow.currentState(), 4n);
    await assert.rejects(escrow.connect(buyer).deposit(Stage.Final, 10n));
    await assert.rejects(escrow.connect(buyer).proposeRelease(Stage.Deposit));

    const buyerBalanceBefore = await token.balanceOf(buyer.address);
    await escrow.connect(agent).proposeRefund(Stage.Deposit);
    await escrow.connect(seller).confirmAction(1n);
    const buyerBalanceAfter = await token.balanceOf(buyer.address);

    assert.equal(buyerBalanceAfter - buyerBalanceBefore, 125n);
    assert.equal(await escrow.currentState(), 3n);

    await assert.rejects(escrow.connect(buyer).deposit(Stage.Final, 5n));
    await assert.rejects(escrow.connect(agent).proposeRelease(Stage.Final));
  });

  it("marks the escrow completed once all three stages are released", async function () {
    const escrow = await createEscrow(other);
    const escrowAddress = await escrow.getAddress();

    await token.mint(buyer.address, 1_000n);
    await token.connect(buyer).approve(escrowAddress, 1_000n);

    await escrow.connect(buyer).deposit(Stage.EOI, targets.eoi);
    await escrow.connect(buyer).deposit(Stage.Deposit, targets.deposit);
    await escrow.connect(buyer).deposit(Stage.Final, targets.final);

    await escrow.connect(buyer).proposeRelease(Stage.EOI);
    await escrow.connect(seller).confirmAction(1n);

    await escrow.connect(agent).proposeRelease(Stage.Deposit);
    await escrow.connect(buyer).confirmAction(2n);

    await escrow.connect(seller).proposeRelease(Stage.Final);
    await escrow.connect(agent).confirmAction(3n);

    assert.equal(await escrow.currentState(), 2n);
    await assert.rejects(escrow.connect(buyer).deposit(Stage.Final, 1n));
    await assert.rejects(escrow.connect(agent).proposeRefund(Stage.Final));
  });
});
