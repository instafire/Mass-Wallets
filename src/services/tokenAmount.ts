/** Convert a decimal amount into atomic units without floating-point rounding. */
export function parseTokenUnits(amount: number | string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) {
    throw new Error('Token decimals must be an integer between 0 and 255.');
  }

  const value = String(amount).trim();
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(value);
  if (!match) {
    throw new Error('Amount must be a valid decimal number.');
  }
  if (match[1] === '-') {
    throw new Error('Amount cannot be negative.');
  }

  const whole = match[2] || '0';
  const fraction = match[4] ?? match[3] ?? '';
  const exponent = Number(match[5] || 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) {
    throw new Error('Amount exponent is outside the supported range.');
  }

  let digits = `${whole}${fraction}`;
  let scale = fraction.length - exponent;

  if (scale < 0) {
    digits += '0'.repeat(-scale);
    scale = 0;
  }

  digits = digits.replace(/^0+(?=\d)/, '') || '0';

  if (scale > decimals) {
    const excessDigits = scale - decimals;
    const padded = digits.padStart(excessDigits + 1, '0');
    const discarded = padded.slice(-excessDigits);
    if (/[1-9]/.test(discarded)) {
      throw new Error(`Amount supports at most ${decimals} decimal places.`);
    }
    digits = padded.slice(0, -excessDigits) || '0';
    scale = decimals;
  }

  return BigInt(digits) * (10n ** BigInt(decimals - scale));
}
