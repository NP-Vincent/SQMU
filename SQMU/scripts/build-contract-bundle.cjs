const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execSync } = require("node:child_process");

const projectRoot = process.cwd();
const artifactsRoot = path.join(projectRoot, "artifacts");
const abiRoot = path.join(projectRoot, "ABI");
const configPath = path.join(projectRoot, "contract-bundle.config.json");
const outputRoot = path.join(projectRoot, "dist", "contract-bundle");
const contractsOutputRoot = path.join(outputRoot, "contracts");
const abiOutputRoot = path.join(outputRoot, "abi");
const supportOutputRoot = path.join(outputRoot, "support");
const proxyArtifactPath = path.join(
  artifactsRoot,
  "@openzeppelin",
  "contracts",
  "proxy",
  "ERC1967",
  "ERC1967Proxy.sol",
  "ERC1967Proxy.json"
);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function rimraf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(walk(fullPath));
      continue;
    }
    files.push(fullPath);
  }

  return files;
}

function findArtifact(contractName) {
  const matches = walk(artifactsRoot).filter((filePath) => {
    return path.basename(filePath) === `${contractName}.json` && !filePath.endsWith(".dbg.json");
  });

  if (matches.length === 0) {
    throw new Error(`Missing artifact for ${contractName}`);
  }

  if (matches.length > 1) {
    throw new Error(`Ambiguous artifact match for ${contractName}: ${matches.join(", ")}`);
  }

  return matches[0];
}

function getGitCommit() {
  try {
    return execSync("git rev-parse HEAD", { cwd: projectRoot, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

function sha256File(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function main() {
  const config = readJson(configPath);
  const version =
    process.env.CONTRACT_BUNDLE_VERSION ||
    process.env.GITHUB_REF_NAME ||
    `dev-${new Date().toISOString().replace(/[:.]/g, "-")}`;

  rimraf(outputRoot);
  ensureDir(contractsOutputRoot);
  ensureDir(abiOutputRoot);
  ensureDir(supportOutputRoot);

  const proxyArtifact = readJson(proxyArtifactPath);
  const proxyOutputPath = path.join(supportOutputRoot, "ERC1967Proxy.json");
  fs.writeFileSync(proxyOutputPath, `${JSON.stringify(proxyArtifact, null, 2)}\n`, "utf8");

  const manifest = {
    schemaVersion: config.schemaVersion,
    releaseTrack: config.releaseTrack,
    releaseVersion: version,
    generatedAt: new Date().toISOString(),
    gitCommit: process.env.GITHUB_SHA || getGitCommit(),
    solcVersion: "0.8.26",
    evmVersion: "cancun",
    support: {
      erc1967Proxy: {
        file: "support/ERC1967Proxy.json",
        sha256: sha256File(proxyOutputPath)
      }
    },
    contracts: []
  };

  for (const contract of config.contracts) {
    const artifactPath = findArtifact(contract.name);
    const artifact = readJson(artifactPath);
    const abiPath = path.join(abiRoot, `${contract.name}.json`);
    const abiExport = readJson(abiPath);

    const contractBundle = {
      name: contract.name,
      sourceName: artifact.sourceName,
      abi: artifact.abi,
      bytecode: artifact.bytecode,
      deployedBytecode: artifact.deployedBytecode,
      linkReferences: artifact.linkReferences,
      deployedLinkReferences: artifact.deployedLinkReferences
    };

    const contractOutputPath = path.join(contractsOutputRoot, `${contract.name}.json`);
    const abiOutputPath = path.join(abiOutputRoot, `${contract.name}.json`);

    fs.writeFileSync(contractOutputPath, `${JSON.stringify(contractBundle, null, 2)}\n`, "utf8");
    fs.writeFileSync(abiOutputPath, `${JSON.stringify(abiExport, null, 2)}\n`, "utf8");

    manifest.contracts.push({
      name: contract.name,
      sourceName: artifact.sourceName,
      deploymentKind: contract.deploymentKind,
      dependsOn: contract.dependsOn,
      initializer: contract.initializer,
      upgrade: contract.upgrade,
      files: {
        contract: `contracts/${contract.name}.json`,
        abi: `abi/${contract.name}.json`
      },
      integrity: {
        contractSha256: sha256File(contractOutputPath),
        abiSha256: sha256File(abiOutputPath)
      }
    });
  }

  fs.writeFileSync(
    path.join(outputRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
}

main();
