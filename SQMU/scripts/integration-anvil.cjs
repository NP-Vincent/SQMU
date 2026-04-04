const fs = require("node:fs");
const path = require("node:path");
const { ethers } = require("ethers");

const projectRoot = process.cwd();
const bundleRoot = process.env.CONTRACT_BUNDLE_DIR || path.join(projectRoot, "dist", "contract-bundle");
const manifestPath = path.join(bundleRoot, "manifest.json");
const reportPath =
  process.env.INTEGRATION_REPORT_PATH || path.join(projectRoot, "dist", "anvil-integration-report.json");
const defaultRpcUrl = process.env.ANVIL_RPC_URL || "http://127.0.0.1:8545";
const defaultPrivateKey =
  process.env.DEPLOYER_PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const PROPERTY_CODE = "PROP-001";
const PROPERTY_REF = ethers.encodeBytes32String(PROPERTY_CODE);
const PROPERTY_TOKEN_ID = 101n;
const GOVERNANCE_TOKEN_ID = 0n;
const PROPERTY_PRICE_USD = ethers.parseUnits("100", 18);
const GOVERNANCE_PRICE_USD = ethers.parseUnits("100", 18);
const STABLE_TOKEN_NAME = "USD Coin";
const STABLE_TOKEN_SYMBOL = "USDC";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runStep(label, fn) {
  console.log(`-> ${label}`);
  return fn();
}

function topologicalOrder(contracts) {
  const byName = new Map(contracts.map((contract) => [contract.name, contract]));
  const visited = new Set();
  const visiting = new Set();
  const ordered = [];

  function visit(name) {
    if (visited.has(name)) return;
    if (visiting.has(name)) {
      throw new Error(`Circular dependency in bundle manifest at ${name}`);
    }

    const contract = byName.get(name);
    if (!contract) {
      throw new Error(`Missing contract metadata for ${name}`);
    }

    visiting.add(name);
    for (const dependency of contract.dependsOn || []) {
      visit(dependency);
    }
    visiting.delete(name);
    visited.add(name);
    ordered.push(contract);
  }

  for (const contract of contracts) {
    visit(contract.name);
  }

  return ordered;
}

function getArtifact(contractMeta) {
  return readJson(path.join(bundleRoot, contractMeta.files.contract));
}

function getArtifactByName(manifest, name) {
  const contractMeta = manifest.contracts.find((contract) => contract.name === name);
  if (!contractMeta) {
    throw new Error(`Missing contract metadata for ${name}`);
  }

  return {
    meta: contractMeta,
    artifact: getArtifact(contractMeta)
  };
}

function getAddress(deployment) {
  return deployment.proxyAddress || deployment.implementationAddress;
}

function getInitializerArgs(contractMeta, deployments, deployerAddress) {
  switch (contractMeta.name) {
    case "SQMU":
      return ["ipfs://sqmu/{id}.json", "SQMU", "SQMU", deployerAddress];
    case "AtomicSQMUDistributor":
      return [300n];
    case "SQMUTrade":
      return [deployerAddress, 250n, getAddress(deployments.AtomicSQMUDistributor)];
    case "SQMUCrowdfund":
      return [getAddress(deployments.SQMU), GOVERNANCE_PRICE_USD];
    case "SQMURentDistribution":
      return [];
    case "SQMURent":
      return [getAddress(deployments.SQMURentDistribution)];
    case "EscrowFactory":
      return [deployments.Escrow.implementationAddress, deployerAddress];
    default:
      return [];
  }
}

async function deployContract(contractMeta, proxyArtifact, deployments, wallet, deployerAddress) {
  const artifact = getArtifact(contractMeta);
  const implementationFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const implementation = await implementationFactory.deploy();
  await implementation.waitForDeployment();
  const implementationAddress = await implementation.getAddress();

  if (contractMeta.deploymentKind !== "uups") {
    return {
      name: contractMeta.name,
      deploymentKind: contractMeta.deploymentKind,
      implementationAddress
    };
  }

  const args = getInitializerArgs(contractMeta, deployments, deployerAddress);
  const iface = new ethers.Interface(artifact.abi);
  const initData = iface.encodeFunctionData(contractMeta.initializer.method, args);
  const proxyFactory = new ethers.ContractFactory(proxyArtifact.abi, proxyArtifact.bytecode, wallet);
  const proxy = await proxyFactory.deploy(implementationAddress, initData);
  await proxy.waitForDeployment();

  return {
    name: contractMeta.name,
    deploymentKind: contractMeta.deploymentKind,
    implementationAddress,
    proxyAddress: await proxy.getAddress()
  };
}

async function deployBundle(manifest, provider, wallet, deployerAddress) {
  const proxyArtifact = readJson(path.join(bundleRoot, manifest.support.erc1967Proxy.file));
  const orderedContracts = topologicalOrder(manifest.contracts);
  const deployments = {};

  for (const contractMeta of orderedContracts) {
    deployments[contractMeta.name] = await deployContract(
      contractMeta,
      proxyArtifact,
      deployments,
      wallet,
      deployerAddress
    );
  }

  return deployments;
}

async function mineTime(provider, seconds) {
  await provider.send("evm_increaseTime", [seconds]);
  await provider.send("evm_mine", []);
}

async function latestTimestamp(provider) {
  const latestBlock = await provider.getBlock("latest");
  return Number(latestBlock.timestamp);
}

async function main() {
  const manifest = readJson(manifestPath);
  const provider = new ethers.JsonRpcProvider(defaultRpcUrl);
  const rawWallet = new ethers.Wallet(defaultPrivateKey, provider);
  const wallet = new ethers.NonceManager(rawWallet);
  const deployerAddress = await rawWallet.getAddress();

  const propertyTreasury = await provider.getSigner(1);
  const primaryBuyer = await provider.getSigner(2);
  const agent = await provider.getSigner(3);
  const secondaryBuyer = await provider.getSigner(4);
  const tenant = await provider.getSigner(5);
  const seller = await provider.getSigner(6);
  const platformTreasury = await provider.getSigner(7);

  const propertyTreasuryAddress = await propertyTreasury.getAddress();
  const primaryBuyerAddress = await primaryBuyer.getAddress();
  const agentAddress = await agent.getAddress();
  const secondaryBuyerAddress = await secondaryBuyer.getAddress();
  const tenantAddress = await tenant.getAddress();
  const sellerAddress = await seller.getAddress();
  const platformTreasuryAddress = await platformTreasury.getAddress();

  const chainId = Number((await provider.getNetwork()).chainId);
  const deployments = await deployBundle(manifest, provider, wallet, deployerAddress);

  for (const [name, deployment] of Object.entries(deployments)) {
    assert(getAddress(deployment), `Missing deployed address for ${name}`);
  }

  const { artifact: sqmuArtifact } = getArtifactByName(manifest, "SQMU");
  const { artifact: distributorArtifact } = getArtifactByName(manifest, "AtomicSQMUDistributor");
  const { artifact: tradeArtifact } = getArtifactByName(manifest, "SQMUTrade");
  const { artifact: crowdfundArtifact } = getArtifactByName(manifest, "SQMUCrowdfund");
  const { artifact: rentDistributionArtifact } = getArtifactByName(manifest, "SQMURentDistribution");
  const { artifact: rentArtifact } = getArtifactByName(manifest, "SQMURent");
  const { artifact: escrowFactoryArtifact } = getArtifactByName(manifest, "EscrowFactory");
  const escrowArtifact = readJson(
    path.join(projectRoot, "artifacts", "Contracts", "Escrow.sol", "Escrow.json")
  );
  const mockErc20Artifact = readJson(
    path.join(projectRoot, "artifacts", "Contracts", "mocks", "MockERC20.sol", "MockERC20.json")
  );

  const sqmu = new ethers.Contract(getAddress(deployments.SQMU), sqmuArtifact.abi, wallet);
  const distributor = new ethers.Contract(
    getAddress(deployments.AtomicSQMUDistributor),
    distributorArtifact.abi,
    wallet
  );
  const trade = new ethers.Contract(getAddress(deployments.SQMUTrade), tradeArtifact.abi, wallet);
  const crowdfund = new ethers.Contract(
    getAddress(deployments.SQMUCrowdfund),
    crowdfundArtifact.abi,
    wallet
  );
  const rentDistribution = new ethers.Contract(
    getAddress(deployments.SQMURentDistribution),
    rentDistributionArtifact.abi,
    wallet
  );
  const rent = new ethers.Contract(getAddress(deployments.SQMURent), rentArtifact.abi, wallet);
  const escrowFactory = new ethers.Contract(
    getAddress(deployments.EscrowFactory),
    escrowFactoryArtifact.abi,
    wallet
  );

  const stableTokenFactory = new ethers.ContractFactory(
    mockErc20Artifact.abi,
    mockErc20Artifact.bytecode,
    wallet
  );
  const stableToken = await stableTokenFactory.deploy(STABLE_TOKEN_NAME, STABLE_TOKEN_SYMBOL);
  await stableToken.waitForDeployment();
  const stableTokenAddress = await stableToken.getAddress();
  const stableTokenDecimals = Number(await stableToken.decimals());

  const txHashes = {};
  const stableValue = (value) => ethers.parseUnits(value, stableTokenDecimals);
  const depositAmount = stableValue("50");
  const rentAmount = stableValue("100");
  const governancePurchaseAmount = 3n;
  const propertyPurchaseAmount = 2n;
  const eoiTarget = stableValue("100");
  const depositTarget = stableValue("200");
  const finalTarget = stableValue("300");
  const snapshots = {};

  await runStep("Bootstrap contracts and allowlists", async () => {
    txHashes.distributorCommission = (
      await (await distributor.setGlobalCommission(500n)).wait()
    ).hash;
    txHashes.distributorToken = (
      await (await distributor.allowPaymentToken(stableTokenAddress, true)).wait()
    ).hash;
    txHashes.distributorAgent = (
      await (
        await distributor.registerAgent("AGENT-1", "Primary Agent", agentAddress)
      ).wait()
    ).hash;
    txHashes.distributorProperty = (
      await (
        await distributor.registerProperty(
          PROPERTY_CODE,
          "SQMU Demo Residence",
          getAddress(deployments.SQMU),
          PROPERTY_TOKEN_ID,
          propertyTreasuryAddress,
          PROPERTY_PRICE_USD,
          true
        )
      ).wait()
    ).hash;
    txHashes.tradeTreasury = (await (await trade.setTreasury(platformTreasuryAddress)).wait()).hash;
    txHashes.tradeCommission = (await (await trade.setCommission(500n)).wait()).hash;
    txHashes.tradeDistributor = (
      await (
        await trade.setDistributor(getAddress(deployments.AtomicSQMUDistributor))
      ).wait()
    ).hash;
    txHashes.tradeToken = (await (await trade.allowPaymentToken(stableTokenAddress, true)).wait()).hash;
    txHashes.crowdfundToken = (
      await (await crowdfund.allowPaymentToken(stableTokenAddress, true)).wait()
    ).hash;
    txHashes.rentTreasury = (await (await rent.setTreasury(platformTreasuryAddress)).wait()).hash;
    txHashes.rentFee = (await (await rent.setManagementFee(1000n)).wait()).hash;
    txHashes.rentVault = (
      await (await rent.setVault(getAddress(deployments.SQMURentDistribution))).wait()
    ).hash;
    txHashes.rentToken = (await (await rent.setAcceptedToken(stableTokenAddress, true)).wait()).hash;
    txHashes.escrowToken = (
      await (await escrowFactory.addAllowedToken(stableTokenAddress)).wait()
    ).hash;
  });

  await runStep("Seed token inventory and balances", async () => {
    txHashes.mintPropertyInventory = (
      await (await sqmu.mint(propertyTreasuryAddress, PROPERTY_TOKEN_ID, 20n, "0x")).wait()
    ).hash;
    txHashes.approveDistributor = (
      await (
        await sqmu.connect(propertyTreasury).setApprovalForAll(
          getAddress(deployments.AtomicSQMUDistributor),
          true
        )
      ).wait()
    ).hash;
    txHashes.mintGovernanceInventory = (
      await (await sqmu.mint(getAddress(deployments.SQMUCrowdfund), GOVERNANCE_TOKEN_ID, 50n, "0x")).wait()
    ).hash;
    txHashes.mintPrimaryBuyerStable = (
      await (await stableToken.mint(primaryBuyerAddress, stableValue("1000"))).wait()
    ).hash;
    txHashes.mintSecondaryBuyerStable = (
      await (await stableToken.mint(secondaryBuyerAddress, stableValue("1000"))).wait()
    ).hash;
    txHashes.mintTenantStable = (
      await (await stableToken.mint(tenantAddress, stableValue("1000"))).wait()
    ).hash;
  });

  await runStep("Execute distributor purchase", async () => {
    txHashes.primaryBuyerApproveDistributor = (
      await (
        await stableToken
          .connect(primaryBuyer)
          .approve(getAddress(deployments.AtomicSQMUDistributor), stableValue("1000"))
      ).wait()
    ).hash;
    txHashes.distributorBuy = (
      await (
        await distributor
          .connect(primaryBuyer)
          .buySQMU(PROPERTY_CODE, propertyPurchaseAmount, stableTokenAddress, "AGENT-1")
      ).wait()
    ).hash;
  });
  assert(
    (await sqmu.balanceOf(primaryBuyerAddress, PROPERTY_TOKEN_ID)) === propertyPurchaseAmount,
    "Distributor purchase did not deliver SQMU"
  );
  snapshots.distributor = {
    propertyTreasuryStableBalance: await stableToken.balanceOf(propertyTreasuryAddress),
    agentStableBalance: await stableToken.balanceOf(agentAddress),
    primaryBuyerPropertyBalance: await sqmu.balanceOf(primaryBuyerAddress, PROPERTY_TOKEN_ID)
  };

  await runStep("Execute crowdfund purchase", async () => {
    txHashes.primaryBuyerApproveCrowdfund = (
      await (
        await stableToken
          .connect(primaryBuyer)
          .approve(getAddress(deployments.SQMUCrowdfund), stableValue("1000"))
      ).wait()
    ).hash;
    txHashes.crowdfundBuy = (
      await (
        await crowdfund
          .connect(primaryBuyer)
          .buy(stableTokenAddress, governancePurchaseAmount)
      ).wait()
    ).hash;
  });
  assert(
    (await sqmu.balanceOf(primaryBuyerAddress, GOVERNANCE_TOKEN_ID)) === governancePurchaseAmount,
    "Crowdfund purchase did not deliver governance SQMU"
  );
  snapshots.crowdfund = {
    primaryBuyerGovernanceBalance: await sqmu.balanceOf(primaryBuyerAddress, GOVERNANCE_TOKEN_ID),
    crowdfundStableBalance: await stableToken.balanceOf(getAddress(deployments.SQMUCrowdfund))
  };

  await runStep("Execute secondary market trade", async () => {
    txHashes.primaryBuyerApproveTrade = (
      await (
        await sqmu
          .connect(primaryBuyer)
          .setApprovalForAll(getAddress(deployments.SQMUTrade), true)
      ).wait()
    ).hash;
    txHashes.tradeList = (
      await (
        await trade
          .connect(primaryBuyer)
          .listToken(PROPERTY_CODE, getAddress(deployments.SQMU), PROPERTY_TOKEN_ID, 1n)
      ).wait()
    ).hash;
    txHashes.secondaryBuyerApproveTrade = (
      await (
        await stableToken
          .connect(secondaryBuyer)
          .approve(getAddress(deployments.SQMUTrade), stableValue("1000"))
      ).wait()
    ).hash;
    txHashes.tradeBuy = (
      await (
        await trade.connect(secondaryBuyer).buy(1n, 1n, stableTokenAddress)
      ).wait()
    ).hash;
  });
  assert((await sqmu.balanceOf(secondaryBuyerAddress, PROPERTY_TOKEN_ID)) === 1n, "Trade buy failed");
  snapshots.trade = {
    listing: await trade.getListing(1n),
    platformTreasuryStableBalance: await stableToken.balanceOf(platformTreasuryAddress),
    primaryBuyerStableBalance: await stableToken.balanceOf(primaryBuyerAddress),
    primaryBuyerPropertyBalance: await sqmu.balanceOf(primaryBuyerAddress, PROPERTY_TOKEN_ID),
    secondaryBuyerStableBalance: await stableToken.balanceOf(secondaryBuyerAddress),
    secondaryBuyerPropertyBalance: await sqmu.balanceOf(secondaryBuyerAddress, PROPERTY_TOKEN_ID)
  };

  await runStep("Execute rent collection and distribution", async () => {
    txHashes.tenantApproveRent = (
      await (
        await stableToken
          .connect(tenant)
          .approve(getAddress(deployments.SQMURent), stableValue("1000"))
      ).wait()
    ).hash;
    txHashes.rentDeposit = (
      await (
        await rent.connect(tenant).payDeposit(PROPERTY_TOKEN_ID, stableTokenAddress, depositAmount)
      ).wait()
    ).hash;

    const rentPeriod = Number(await rent.RENT_PERIOD());
    const rentWindow = Number(await rent.RENT_WINDOW());
    await mineTime(provider, rentPeriod - rentWindow);

    txHashes.rentCollect = (
      await (
        await rent.connect(tenant).collectRent(PROPERTY_TOKEN_ID, stableTokenAddress, rentAmount)
      ).wait()
    ).hash;
    txHashes.withdrawManagementFees = (
      await (await rent.withdrawManagementFees(stableTokenAddress)).wait()
    ).hash;
    txHashes.distributeRent = (
      await (
        await rentDistribution.distribute(
          PROPERTY_TOKEN_ID,
          stableTokenAddress,
          [primaryBuyerAddress, secondaryBuyerAddress],
          [stableValue("45"), stableValue("45")]
        )
      ).wait()
    ).hash;
  });

  const vaultBalance = await rentDistribution.rentBalances(PROPERTY_TOKEN_ID, stableTokenAddress);
  assert(vaultBalance === 0n, "Rent distribution vault still holds seeded rent");
  snapshots.rent = {
    platformTreasuryStableBalance: await stableToken.balanceOf(platformTreasuryAddress),
    tenantStableBalance: await stableToken.balanceOf(tenantAddress),
    primaryBuyerStableBalance: await stableToken.balanceOf(primaryBuyerAddress),
    secondaryBuyerStableBalance: await stableToken.balanceOf(secondaryBuyerAddress),
    vaultRemainingBalance: vaultBalance
  };

  await runStep("Execute escrow creation and release", async () => {
    const deadline = BigInt((await latestTimestamp(provider)) + 7 * 24 * 60 * 60);
    txHashes.createEscrow = (
      await (
        await escrowFactory.createEscrow(
          secondaryBuyerAddress,
          sellerAddress,
          agentAddress,
          stableTokenAddress,
          PROPERTY_REF,
          deadline,
          eoiTarget,
          depositTarget,
          finalTarget
        )
      ).wait()
    ).hash;

    const escrowAddresses = await escrowFactory.getEscrows();
    const escrowAddress = escrowAddresses[escrowAddresses.length - 1];
    const escrow = new ethers.Contract(escrowAddress, escrowArtifact.abi, wallet);

    txHashes.secondaryBuyerApproveEscrow = (
      await (
        await stableToken.connect(secondaryBuyer).approve(escrowAddress, stableValue("1000"))
      ).wait()
    ).hash;
    txHashes.escrowDeposit = (
      await (
        await escrow.connect(secondaryBuyer).deposit(0, eoiTarget)
      ).wait()
    ).hash;
    txHashes.escrowProposeRelease = (
      await (
        await escrow.connect(secondaryBuyer).proposeRelease(0)
      ).wait()
    ).hash;
    txHashes.escrowConfirmRelease = (
      await (
        await escrow.connect(seller).confirmAction(1n)
      ).wait()
    ).hash;

    const eoiDetails = await escrow.getStageDetails(0);
    assert(eoiDetails[3] === 1n, "Escrow EOI stage was not released");
    assert((await escrow.currentState()) === 1n, "Escrow should remain active after one stage release");

    return { escrowAddress, deadline };
  });

  const distributorTotalPaid =
    (PROPERTY_PRICE_USD * propertyPurchaseAmount * (10n ** BigInt(stableTokenDecimals))) /
    ethers.parseUnits("1", 18);
  const distributorCommission = (distributorTotalPaid * 500n) / 10000n;
  const crowdfundTotalPaid = GOVERNANCE_PRICE_USD * governancePurchaseAmount;
  const tradeTotalPaid = await stableToken.balanceOf(platformTreasuryAddress);
  const rentManagementFee = (rentAmount * 1000n) / 10000n;
  const sellerStableBalance = await stableToken.balanceOf(sellerAddress);

  const escrowAddresses = await escrowFactory.getEscrows();
  const escrowAddress = escrowAddresses[escrowAddresses.length - 1];
  const escrow = new ethers.Contract(escrowAddress, escrowArtifact.abi, wallet);
  const escrowAction = await escrow.getAction(1n);
  const escrowEoiDetails = await escrow.getStageDetails(0);

  const report = {
    chainId,
    rpcUrl: defaultRpcUrl,
    bundle: {
      version: manifest.releaseVersion,
      generatedAt: manifest.generatedAt
    },
    checkedAt: new Date().toISOString(),
    token: {
      address: stableTokenAddress,
      name: STABLE_TOKEN_NAME,
      symbol: STABLE_TOKEN_SYMBOL,
      decimals: Number(stableTokenDecimals)
    },
    actors: {
      deployer: deployerAddress,
      propertyTreasury: propertyTreasuryAddress,
      primaryBuyer: primaryBuyerAddress,
      secondaryBuyer: secondaryBuyerAddress,
      tenant: tenantAddress,
      seller: sellerAddress,
      agent: agentAddress,
      platformTreasury: platformTreasuryAddress
    },
    property: {
      code: PROPERTY_CODE,
      ref: PROPERTY_REF,
      tokenId: PROPERTY_TOKEN_ID.toString(),
      priceUsd: PROPERTY_PRICE_USD.toString()
    },
    deployments,
    txHashes,
    flows: {
      distributor: {
        purchasedAmount: propertyPurchaseAmount.toString(),
        totalPaid: distributorTotalPaid.toString(),
        commissionPaid: distributorCommission.toString(),
        propertyTreasuryStableBalance: snapshots.distributor.propertyTreasuryStableBalance.toString(),
        agentStableBalance: snapshots.distributor.agentStableBalance.toString(),
        primaryBuyerPropertyBalance: snapshots.distributor.primaryBuyerPropertyBalance.toString()
      },
      crowdfund: {
        governancePurchaseAmount: governancePurchaseAmount.toString(),
        totalPaid: crowdfundTotalPaid.toString(),
        primaryBuyerGovernanceBalance: snapshots.crowdfund.primaryBuyerGovernanceBalance.toString(),
        crowdfundStableBalance: snapshots.crowdfund.crowdfundStableBalance.toString()
      },
      trade: {
        listingId: "1",
        active: snapshots.trade.listing.active,
        remainingAmount: snapshots.trade.listing.amountListed.toString(),
        primaryBuyerPropertyBalance: snapshots.trade.primaryBuyerPropertyBalance.toString(),
        secondaryBuyerPropertyBalance: snapshots.trade.secondaryBuyerPropertyBalance.toString(),
        platformTreasuryStableBalance: snapshots.trade.platformTreasuryStableBalance.toString(),
        primaryBuyerStableBalance: snapshots.trade.primaryBuyerStableBalance.toString(),
        secondaryBuyerStableBalance: snapshots.trade.secondaryBuyerStableBalance.toString(),
        sampledTreasuryBalance: tradeTotalPaid.toString()
      },
      rent: {
        depositAmount: depositAmount.toString(),
        rentAmount: rentAmount.toString(),
        managementFee: rentManagementFee.toString(),
        platformTreasuryStableBalance: snapshots.rent.platformTreasuryStableBalance.toString(),
        tenantStableBalance: snapshots.rent.tenantStableBalance.toString(),
        primaryBuyerStableBalance: snapshots.rent.primaryBuyerStableBalance.toString(),
        secondaryBuyerStableBalance: snapshots.rent.secondaryBuyerStableBalance.toString(),
        vaultRemainingBalance: snapshots.rent.vaultRemainingBalance.toString()
      },
      escrow: {
        escrowAddress,
        actionId: "1",
        sellerStableBalance: sellerStableBalance.toString(),
        actionConfirmedCount: escrowAction[3].toString(),
        eoiHeldAmount: escrowEoiDetails[2].toString(),
        eoiSettlement: escrowEoiDetails[3].toString()
      }
    }
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Integration scenario complete on chain ${chainId}`);
  console.log(`Report written to ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
