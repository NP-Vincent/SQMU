const USD_DECIMALS = 2;
const USD_BASE = 10 ** USD_DECIMALS;

const isNumericString = (value) => /^-?\d+$/.test(value);

const parseNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
};

const parseUnits = (units) => {
  if (typeof units === 'bigint') {
    return units;
  }
  if (typeof units === 'number' && Number.isFinite(units)) {
    return BigInt(Math.trunc(units));
  }
  if (typeof units === 'string') {
    const trimmed = units.trim();
    if (trimmed && isNumericString(trimmed)) {
      return BigInt(trimmed);
    }
  }
  return null;
};

export function toSQMUUnits(amount) {
  const parsed = parseNumber(amount);
  if (parsed === null) {
    return null;
  }
  return Math.round(parsed * USD_BASE);
}

export function fromSQMUUnits(units) {
  const parsed = parseUnits(units);
  if (parsed === null) {
    return '0.00';
  }
  const negative = parsed < 0n;
  const absolute = negative ? -parsed : parsed;
  const whole = absolute / BigInt(USD_BASE);
  const fraction = absolute % BigInt(USD_BASE);
  const formatted = `${whole}.${fraction.toString().padStart(USD_DECIMALS, '0')}`;
  return negative ? `-${formatted}` : formatted;
}

export function usdToTokenUnits(usdAmount, tokenDecimals = 18) {
  const cents = toSQMUUnits(usdAmount);
  if (cents === null) {
    return null;
  }
  const decimals = BigInt(tokenDecimals);
  return (BigInt(cents) * 10n ** decimals) / BigInt(USD_BASE);
}

export function formatUsd(amount) {
  const parsed = parseNumber(amount);
  if (parsed === null) {
    return '$0.00';
  }
  return `$${parsed.toFixed(USD_DECIMALS)}`;
}
