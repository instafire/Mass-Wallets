import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTokenUnits } from './tokenAmount';

test('parses ordinary decimals exactly without floating-point loss', () => {
  assert.equal(parseTokenUnits('1.234567891', 9), 1_234_567_891n);
  assert.equal(parseTokenUnits('0.000001', 6), 1n);
  assert.equal(parseTokenUnits('1.2300', 2), 123n);
});

test('supports scientific notation without converting through floating point', () => {
  assert.equal(parseTokenUnits('1e-3', 9), 1_000_000n);
  assert.equal(parseTokenUnits('2.5E+2', 2), 25_000n);
});

test('rejects negative and malformed values instead of turning them positive', () => {
  for (const value of ['-1', '-0.25', '1abc', '1.2.3', '', 'NaN', 'Infinity']) {
    assert.throws(() => parseTokenUnits(value, 9), /Amount/);
  }
});

test('rejects non-zero precision beyond token decimals but permits trailing zeroes', () => {
  assert.throws(() => parseTokenUnits('1.0001', 3), /decimal places/);
  assert.equal(parseTokenUnits('1.2300', 2), 123n);
});

test('rejects invalid decimal counts and unreasonable exponents', () => {
  assert.throws(() => parseTokenUnits('1', -1), /decimals/);
  assert.throws(() => parseTokenUnits('1', 256), /decimals/);
  assert.throws(() => parseTokenUnits('1e1001', 9), /exponent/);
});
