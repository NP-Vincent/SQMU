const { ethers } = require("hardhat");

async function deployProxy(factory, initArgs) {
  const implementation = await factory.deploy();
  const initData = factory.interface.encodeFunctionData("initialize", initArgs);
  const Proxy = await ethers.getContractFactory("TestERC1967Proxy");
  const proxy = await Proxy.deploy(await implementation.getAddress(), initData);
  return factory.attach(await proxy.getAddress());
}

async function latestTimestamp() {
  const block = await ethers.provider.getBlock("latest");
  return Number(block.timestamp);
}

async function increaseTime(seconds) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

module.exports = {
  deployProxy,
  latestTimestamp,
  increaseTime
};
