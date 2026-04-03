const fs = require("node:fs");
const path = require("node:path");
const { ethers } = require("ethers");

const projectRoot = process.cwd();
const bundleRoot = process.env.CONTRACT_BUNDLE_DIR || path.join(projectRoot, "dist", "contract-bundle");
const manifestPath = path.join(bundleRoot, "manifest.json");
const reportPath = path.join(projectRoot, "dist", "anvil-smoke-report.json");
const defaultRpcUrl = process.env.ANVIL_RPC_URL || "http://127.0.0.1:8545";
const defaultPrivateKey =
  process.env.DEPLOYER_PRIVATE_KEY ||
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

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
      return [getAddress(deployments.SQMU), ethers.parseUnits("100", 18)];
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
  const implementationFactory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );
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
  const proxyFactory = new ethers.ContractFactory(
    proxyArtifact.abi,
    proxyArtifact.bytecode,
    wallet
  );
  const proxy = await proxyFactory.deploy(implementationAddress, initData);
  await proxy.waitForDeployment();

  return {
    name: contractMeta.name,
    deploymentKind: contractMeta.deploymentKind,
    implementationAddress,
    proxyAddress: await proxy.getAddress()
  };
}

async function main() {
  const manifest = readJson(manifestPath);
  const proxyArtifact = readJson(path.join(bundleRoot, manifest.support.erc1967Proxy.file));
  const provider = new ethers.JsonRpcProvider(defaultRpcUrl);
  const rawWallet = new ethers.Wallet(defaultPrivateKey, provider);
  const wallet = new ethers.NonceManager(rawWallet);
  const deployerAddress = await rawWallet.getAddress();
  const seller = await provider.getSigner(1);
  const buyer = await provider.getSigner(2);
  const agent = await provider.getSigner(3);

  const chainId = Number((await provider.getNetwork()).chainId);
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

  for (const [name, deployment] of Object.entries(deployments)) {
    assert(getAddress(deployment), `Missing deployed address for ${name}`);
  }

  const dummyToken = "0x00000000000000000000000000000000000000f1";
  const sqmuArtifact = getArtifact(manifest.contracts.find((contract) => contract.name === "SQMU"));
  const distributorArtifact = getArtifact(
    manifest.contracts.find((contract) => contract.name === "AtomicSQMUDistributor")
  );
  const tradeArtifact = getArtifact(manifest.contracts.find((contract) => contract.name === "SQMUTrade"));
  const crowdfundArtifact = getArtifact(
    manifest.contracts.find((contract) => contract.name === "SQMUCrowdfund")
  );
  const rentDistributionArtifact = getArtifact(
    manifest.contracts.find((contract) => contract.name === "SQMURentDistribution")
  );
  const rentArtifact = getArtifact(manifest.contracts.find((contract) => contract.name === "SQMURent"));
  const escrowFactoryArtifact = getArtifact(
    manifest.contracts.find((contract) => contract.name === "EscrowFactory")
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

  assert((await sqmu.owner()) === deployerAddress, "SQMU owner mismatch");
  assert((await crowdfund.sqmu()) === getAddress(deployments.SQMU), "Crowdfund SQMU link mismatch");
  assert((await rent.vault()) === getAddress(deployments.SQMURentDistribution), "Rent vault mismatch");
  assert((await trade.distributor()) === getAddress(deployments.AtomicSQMUDistributor), "Trade distributor mismatch");
  assert(
    (await escrowFactory.escrowImplementation()) === deployments.Escrow.implementationAddress,
    "EscrowFactory implementation mismatch"
  );

  await runStep("Seed SQMU balances", async () => {
    await (await sqmu.mint(deployerAddress, 1n, 10n, "0x")).wait();
    await (await sqmu.mint(deployerAddress, 0n, 20n, "0x")).wait();
    await (await sqmu.mint(deployerAddress, 7n, 3n, "0x")).wait();
  });

  await runStep("Configure distributor", async () => {
    await (await distributor.allowPaymentToken(dummyToken, true)).wait();
    await (await distributor.registerAgent("AGENT-1", "Primary Agent", await agent.getAddress())).wait();
    await (
      await distributor.registerProperty(
        "PROP-001",
        "SQMU Demo Property",
        getAddress(deployments.SQMU),
        1n,
        deployerAddress,
        ethers.parseUnits("100", 18),
        true
      )
    ).wait();
    await (await sqmu.setApprovalForAll(getAddress(deployments.AtomicSQMUDistributor), true)).wait();
    await (await distributor.manualDistribute("PROP-001", await buyer.getAddress(), 1n, "")).wait();
  });
  assert((await sqmu.balanceOf(await buyer.getAddress(), 1n)) === 1n, "Distributor manual transfer failed");

  await runStep("Configure crowdfund", async () => {
    await (await sqmu.safeTransferFrom(deployerAddress, getAddress(deployments.SQMUCrowdfund), 0n, 5n, "0x")).wait();
    await (await crowdfund.allowPaymentToken(dummyToken, true)).wait();
  });
  assert((await crowdfund.isAllowedToken(dummyToken)) === true, "Crowdfund allowlist failed");

  await runStep("List and cancel a trade listing", async () => {
    await (await sqmu.safeTransferFrom(deployerAddress, await seller.getAddress(), 1n, 2n, "0x")).wait();
    const sellerSqmu = sqmu.connect(seller);
    await (await sellerSqmu.setApprovalForAll(getAddress(deployments.SQMUTrade), true)).wait();
    const sellerTrade = trade.connect(seller);
    await (await sellerTrade.listToken("PROP-001", getAddress(deployments.SQMU), 1n, 2n)).wait();
    const listing = await trade.getListing(1n);
    assert(listing.active === true, "Trade listing inactive after create");
    await (await sellerTrade.cancelListing(1n)).wait();
  });
  const cancelledListing = await trade.getListing(1n);
  assert(cancelledListing.active === false, "Trade listing cancel failed");

  await runStep("Exercise rent distribution NFT custody", async () => {
    await (await sqmu.setApprovalForAll(getAddress(deployments.SQMURentDistribution), true)).wait();
    await (await rentDistribution.depositNFT(getAddress(deployments.SQMU), 7n, 1n, "0x")).wait();
    await (
      await rentDistribution.withdrawNFT(getAddress(deployments.SQMU), 7n, 1n, await buyer.getAddress())
    ).wait();
  });
  assert((await sqmu.balanceOf(await buyer.getAddress(), 7n)) === 1n, "Rent distribution NFT withdraw failed");

  await runStep("Exercise rent NFT custody", async () => {
    await (await sqmu.setApprovalForAll(getAddress(deployments.SQMURent), true)).wait();
    await (await rent.setAcceptedToken(dummyToken, true)).wait();
    await (await rent.setTreasury(deployerAddress)).wait();
    await (await rent.depositNFT(getAddress(deployments.SQMU), 7n, 1n, "0x")).wait();
    await (await rent.withdrawNFT(getAddress(deployments.SQMU), 7n, 1n, await buyer.getAddress())).wait();
  });
  assert((await sqmu.balanceOf(await buyer.getAddress(), 7n)) === 2n, "Rent NFT withdraw failed");

  await runStep("Create a factory escrow", async () => {
    await (await escrowFactory.addAllowedToken(dummyToken)).wait();
    const latestBlock = await provider.getBlock("latest");
    const deadline = BigInt(latestBlock.timestamp + 7 * 24 * 60 * 60);
    await (
      await escrowFactory.createEscrow(
        await buyer.getAddress(),
        await seller.getAddress(),
        await agent.getAddress(),
        dummyToken,
        ethers.encodeBytes32String("PROP-001"),
        deadline,
        100n,
        200n,
        300n
      )
    ).wait();
  });
  assert((await escrowFactory.getEscrowCount()) === 1n, "EscrowFactory did not create escrow");

  const report = {
    chainId,
    rpcUrl: defaultRpcUrl,
    bundle: {
      version: manifest.releaseVersion,
      generatedAt: manifest.generatedAt
    },
    smokeCheckedAt: new Date().toISOString(),
    deployer: deployerAddress,
    deployments
  };

  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Smoke deployment complete on chain ${chainId}`);
  console.log(`Report written to ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
