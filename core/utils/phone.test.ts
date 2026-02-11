import test from 'node:test';
import assert from 'node:assert/strict';
import { isPhoneLongerThan, validateAndNormalizePhone } from './phone.js';

test('validateAndNormalizePhone validates an Italian number and normalizes to E.164', () => {
  const result = validateAndNormalizePhone('333 123 4567', 'IT');

  assert.equal(result.isValid, true);
  assert.equal(result.e164, '+393331234567');
});

test('validateAndNormalizePhone validates an international number already in E.164', () => {
  const result = validateAndNormalizePhone('+1 202-555-0125');

  assert.equal(result.isValid, true);
  assert.equal(result.e164, '+12025550125');
});

test('validateAndNormalizePhone rejects a too-short number', () => {
  const result = validateAndNormalizePhone('12345', 'IT');

  assert.equal(result.isValid, false);
});

test('validateAndNormalizePhone rejects a too-long number', () => {
  const result = validateAndNormalizePhone('+393331234567891234', 'IT');

  assert.equal(result.isValid, false);
});

test('validateAndNormalizePhone accepts numbers with spaces and dashes', () => {
  const result = validateAndNormalizePhone('333-123 4567', 'IT');

  assert.equal(result.isValid, true);
  assert.equal(result.e164, '+393331234567');
});

test('isPhoneLongerThan checks real digits from normalized number', () => {
  assert.equal(isPhoneLongerThan('333 123 4567', 11), true);
  assert.equal(isPhoneLongerThan('333 123 4567', 12), false);
});
