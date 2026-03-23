export const SQMU_ADDRESS = '0xd0b895e975f24045e43d788d42BD938b78666EC8';
export const DISTRIBUTOR_ADDRESS = '0x19d8D25DD4C85264B2AC502D66aEE113955b8A07';
export const TRADE_ADDRESS = '0x4F1BFDC7EBba77e7ec76C6AEbE81C0e84d28470B';

export const DEFAULT_CHAIN = {
  id: 59144,
  name: 'Linea',
  rpcUrl: '',
  blockExplorerUrl: 'https://lineascan.build',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18
  }
};

export const DEFAULT_PAYMENT_TOKENS = [
  {
    address: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4',
    symbol: 'USDC',
    decimals: 6
  },
  {
    address: '0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df',
    symbol: 'USDT',
    decimals: 6
  }
];
