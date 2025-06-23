import { describe, it, expect } from 'vitest';
import { SoundChip } from './soundchip';

describe('SoundChip - Channel 1', () => {
  it('should have a square wave channel 1', () => {
    const soundChip = new SoundChip();
    expect(soundChip.channel1).toBeDefined();
  });
});
