import { describe, it, expect } from 'vitest';
import { SoundChip } from './soundchip';

describe('SoundChip - All Channels', () => {
  it('should have all four sound channels', () => {
    const soundChip = new SoundChip();
    expect(soundChip.channel1).toBeDefined();
    expect(soundChip.channel2).toBeDefined();
    expect(soundChip.channel3).toBeDefined();
    expect(soundChip.channel4).toBeDefined();
  });
});
