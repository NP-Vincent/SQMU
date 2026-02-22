const PAYMENT_TOKENS = [
  {
    symbol: 'USDC',
    address: '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4',
    decimals: 6
  },
  {
    symbol: 'USDT',
    address: '0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df',
    decimals: 6
  }
];

const normalizeAddress = (address) => (address ? address.toLowerCase() : '');

const PAYMENT_TOKEN_MAP = new Map(
  PAYMENT_TOKENS.map((token) => [normalizeAddress(token.address), token])
);

export const getPaymentToken = (address) =>
  PAYMENT_TOKEN_MAP.get(normalizeAddress(address)) ?? null;

export const getPaymentTokensFromList = (addresses) =>
  (addresses ?? [])
    .map(getPaymentToken)
    .filter(Boolean);

export const getDefaultPaymentTokens = () => PAYMENT_TOKENS.slice();
