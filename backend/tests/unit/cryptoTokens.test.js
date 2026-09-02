import { describe, it, expect } from 'vitest';
import { generateRawToken, hashToken } from '../../src/utils/cryptoTokens.js';

describe('cryptoTokens', () => {
  it('generates unique raw tokens', () => {
    const a = generateRawToken();
    const b = generateRawToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it('hashes deterministically', () => {
    const raw = generateRawToken();
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it('never stores the raw token as its own hash', () => {
    const raw = generateRawToken();
    expect(hashToken(raw)).not.toBe(raw);
  });
});
