const fs = require("node:fs");
const path = require("node:path");

const projectRoot = process.cwd();
const artifactsRoot = path.join(projectRoot, "artifacts");
const outputRoot = path.join(projectRoot, "ABI");

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

function exportAbi(contractName) {
  const artifactPath = findArtifact(contractName);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const output = {
    name: contractName,
    address: "",
    abi: artifact.abi,
    filePath: artifact.sourceName
  };

  fs.writeFileSync(
    path.join(outputRoot, `${contractName}.json`),
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8"
  );
}

for (const contractName of ["Escrow", "EscrowFactory"]) {
  exportAbi(contractName);
}
