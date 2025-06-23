import { describe, it, expect, vi } from 'vitest';
import { SoundChip } from './soundchip';

describe('SoundChip - Channel 4 Register Routing', () => {
  it('routes 0xFF20–0xFF23 writes to channel4', () => {
    const chip = new SoundChip();
    const spy = vi.spyOn(chip.channel4, 'writeRegister');
    chip.writeRegister(0xFF20, 0xFF);
    chip.writeRegister(0xFF21, 0xF3);
    chip.writeRegister(0xFF22, 0xAA);
    chip.writeRegister(0xFF23, 0xBF);
    expect(spy).toHaveBeenCalledTimes(4);
    expect(spy).toHaveBeenCalledWith(0xFF20, 0xFF);
    expect(spy).toHaveBeenCalledWith(0xFF21, 0xF3);
    expect(spy).toHaveBeenCalledWith(0xFF22, 0xAA);
    expect(spy).toHaveBeenCalledWith(0xFF23, 0xBF);
  });
});
