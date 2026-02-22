import { Contract } from 'ethers';
import sqmuDefinition from '../../contracts/abi/SQMU.json';

export const sqmuAbi = sqmuDefinition.abi;
export const defaultSqmuAddress = sqmuDefinition.address;

export function createSqmuContract({ signer, address }) {
  return new Contract(address, sqmuAbi, signer);
}

export function createSqmuReadOnly({ provider, address }) {
  return new Contract(address, sqmuAbi, provider);
}
