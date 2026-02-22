import { Contract } from 'ethers';
import distributorDefinition from '../../contracts/abi/AtomicSQMUDistributor.json';

export const distributorAbi = distributorDefinition.abi;
export const defaultDistributorAddress = distributorDefinition.address;

export function createDistributorContract({ signer, address }) {
  return new Contract(address, distributorAbi, signer);
}

export function createDistributorReadOnly({ provider, address }) {
  return new Contract(address, distributorAbi, provider);
}
