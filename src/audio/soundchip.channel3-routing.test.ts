import { describe, it, expect, vi } from 'vitest';
import { SoundChip } from './soundchip';

describe('SoundChip - Channel 3 Register Routing', () => {
  it('routes 0xFF1A–0xFF1E writes to channel3', () => {
    const chip = new SoundChip();
    const spy = vi.spyOn(chip.channel3, 'writeRegister');
    chip.writeRegister(0xFF1A, 0x7F);
    chip.writeRegister(0xFF1B, 0xFF);
    chip.writeRegister(0xFF1C, 0x9F);
    chip.writeRegister(0xFF1D, 0xAA);
    chip.writeRegister(0xFF1E, 0xBF);
    expect(spy).toHaveBeenCalledTimes(5);
    expect(spy).toHaveBeenCalledWith(0xFF1A, 0x7F);
    expect(spy).toHaveBeenCalledWith(0xFF1B, 0xFF);
    expect(spy).toHaveBeenCalledWith(0xFF1C, 0x9F);
    expect(spy).toHaveBeenCalledWith(0xFF1D, 0xAA);
    expect(spy).toHaveBeenCalledWith(0xFF1E, 0xBF);
  });
});
