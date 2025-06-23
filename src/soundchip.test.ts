import { describe, it, expect } from 'vitest';
import { SoundChip } from '../src/soundchip';

describe('SoundChip', () => {
  it('can be instantiated', () => {
    const soundChip = new SoundChip();
    expect(soundChip).toBeInstanceOf(SoundChip);
  });
});
