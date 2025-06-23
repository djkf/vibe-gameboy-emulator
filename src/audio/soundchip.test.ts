import { describe, it, expect } from 'vitest';
import { SoundChip } from './soundchip';

describe('SoundChip', () => {
  it('can be instantiated', () => {
    const soundChip = new SoundChip();
    expect(soundChip).toBeInstanceOf(SoundChip);
  });
});
