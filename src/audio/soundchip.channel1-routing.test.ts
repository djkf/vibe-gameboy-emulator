import { describe, it, expect, vi } from 'vitest';
import { SoundChip } from './soundchip';

describe('SoundChip - Channel 1 Register Routing', () => {
  it('routes 0xFF10–0xFF14 writes to channel1', () => {
    const chip = new SoundChip();
    const spy = vi.spyOn(chip.channel1, 'writeRegister');
    chip.writeRegister(0xFF10, 0x8F);
    chip.writeRegister(0xFF11, 0x3F);
    chip.writeRegister(0xFF12, 0xF3);
    chip.writeRegister(0xFF13, 0xAA);
    chip.writeRegister(0xFF14, 0xBF);
    expect(spy).toHaveBeenCalledTimes(5);
    expect(spy).toHaveBeenCalledWith(0xFF10, 0x8F);
    expect(spy).toHaveBeenCalledWith(0xFF11, 0x3F);
    expect(spy).toHaveBeenCalledWith(0xFF12, 0xF3);
    expect(spy).toHaveBeenCalledWith(0xFF13, 0xAA);
    expect(spy).toHaveBeenCalledWith(0xFF14, 0xBF);
  });
});
