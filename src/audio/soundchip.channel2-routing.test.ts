import { describe, it, expect, vi } from 'vitest';
import { SoundChip } from './soundchip';

describe('SoundChip - Channel 2 Register Routing', () => {
  it('routes 0xFF16–0xFF19 writes to channel2', () => {
    const chip = new SoundChip();
    const spy = vi.spyOn(chip.channel2, 'writeRegister');
    chip.writeRegister(0xFF16, 0x3F);
    chip.writeRegister(0xFF17, 0xF3);
    chip.writeRegister(0xFF18, 0xAA);
    chip.writeRegister(0xFF19, 0xBF);
    expect(spy).toHaveBeenCalledTimes(4);
    expect(spy).toHaveBeenCalledWith(0xFF16, 0x3F);
    expect(spy).toHaveBeenCalledWith(0xFF17, 0xF3);
    expect(spy).toHaveBeenCalledWith(0xFF18, 0xAA);
    expect(spy).toHaveBeenCalledWith(0xFF19, 0xBF);
  });
});
