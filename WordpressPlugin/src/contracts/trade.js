import { Contract } from 'ethers';
import tradeDefinition from '../../contracts/abi/SQMUTrade.json';

const tradeAbi = [
  'function getActiveListings() external view returns (tuple(uint256 listingId, address seller, string propertyCode, address tokenAddress, uint256 tokenId, uint256 amountListed, bool active)[])',
  'function listToken(string propertyCode, address tokenAddress, uint256 tokenId, uint256 amount) external',
  'function buy(uint256 listingId, uint256 amount, address paymentToken) external'
];

export const defaultTradeAddress = tradeDefinition.address;

export function createTradeContract({ signer, address }) {
  return new Contract(address, tradeAbi, signer);
}

export function createTradeReadOnly({ provider, address }) {
  return new Contract(address, tradeAbi, provider);
}
