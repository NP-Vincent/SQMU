import { Contract } from 'ethers';

const erc20Abi = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)'
];

export function createErc20Contract({ signer, address }) {
  return new Contract(address, erc20Abi, signer);
}
