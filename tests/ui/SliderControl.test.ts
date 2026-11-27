import { describe, expect, it } from 'vitest';
import { snapValue } from '../../src/ui/SliderControl';

describe('snapValue', () => {
  it('snaps to the closest snap point within tolerance', () => {
    expect(snapValue(2.2, [1, 2, 3], 0.3)).toBe(2);
    expect(snapValue(1.1, [1, 2, 3], 0.3)).toBe(1);
    expect(snapValue(2.9, [1, 2, 3], 0.3)).toBe(3);
    expect(snapValue(2.1, [1, 2, 3], 0.3)).toBe(2);
  });

  it('returns the raw value when no snap point is within tolerance', () => {
    expect(snapValue(2.5, [1, 2, 3], 0.3)).toBe(2.5);
    expect(snapValue(2.2, [1, 2, 3], 0)).toBe(2.2);
    expect(snapValue(5, [1, 2, 3], 0.3)).toBe(5);
  });
});
