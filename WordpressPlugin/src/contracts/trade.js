import { Contract } from 'ethers';
import tradeDefinition from '../../../SQMU/ABI/SQMUTrade.json';

export const tradeAbi = tradeDefinition.abi;
export const defaultTradeAddress = tradeDefinition.address;

export function createTradeContract({ signer, address }) {
  return new Contract(address, tradeAbi, signer);
}

export function createTradeReadOnly({ provider, address }) {
  return new Contract(address, tradeAbi, provider);
}
