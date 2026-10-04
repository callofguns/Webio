import { describe, expect, it } from 'vitest';
import { priceText, retainerFee } from './pricing';

describe('price plans', () => {
  it('the monthly retainer is a tenth of the full price', () => {
    expect(retainerFee(1000)).toBe(100);
    expect(retainerFee(1350)).toBe(135);
    expect(retainerFee(95)).toBe(10);
  });

  it('describes what the client pays', () => {
    expect(priceText('buyout', 1000)).toBe('$1,000');
    expect(priceText(undefined, 1000)).toBe('$1,000');
    expect(priceText('retainer', 1000)).toBe('$100 a month');
  });
});
