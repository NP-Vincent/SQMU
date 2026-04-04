const fs = require("node:fs");
const path = require("node:path");

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) {
    throw new Error(`Missing required argument ${name}`);
  }
  return process.argv[index + 1];
}

function parseChecksumFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  const match = raw.match(/^([a-fA-F0-9]{64})\s+/);
  if (!match) {
    throw new Error(`Could not parse SHA-256 checksum from ${filePath}`);
  }
  return match[1].toLowerCase();
}

function main() {
  const filePath = path.resolve(readArg("--file"));
  const version = readArg("--version");
  const tag = readArg("--tag");
  const asset = readArg("--asset");
  const checksumFile = path.resolve(readArg("--checksum-file"));

  const current = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const updated = {
    schemaVersion: Number(current?.schemaVersion) || 1,
    enabled: true,
    release: {
      version,
      tag,
      asset,
      sha256: parseChecksumFile(checksumFile)
    }
  };

  fs.writeFileSync(filePath, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
}

main();
