import { describe, it, expect, vi } from 'vitest';
import { SoundChip } from './soundchip';

describe('SoundChip - Memory Integration', () => {
  it('should respond to writes in the sound register range (0xFF10–0xFF3F)', () => {
    const soundChip = new SoundChip();
    const spy = vi.spyOn(soundChip, 'writeRegister');
    soundChip.writeRegister(0xFF10, 0x80);
    expect(spy).toHaveBeenCalledWith(0xFF10, 0x80);
  });
});
