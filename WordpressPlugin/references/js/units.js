export function toStablecoinUnits(amount, decimals) {
  return ethers.utils.parseUnits(amount.toString(), decimals);
}

export function fromStablecoinUnits(units, decimals) {
  const bn = ethers.BigNumber.isBigNumber(units)
    ? units
    : ethers.BigNumber.from(units);
  return parseFloat(ethers.utils.formatUnits(bn, decimals)).toFixed(2);
}

export function toSQMUUnits(amount) {
  return Math.round(parseFloat(amount) * 100); // 2 decimals
}

export function fromSQMUUnits(units) {
  return (parseInt(units) / 100).toFixed(2);
}
