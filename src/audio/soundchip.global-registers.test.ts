import { describe, it, expect } from 'vitest';
import { SoundChip } from './soundchip';

describe('SoundChip - Global Sound Registers', () => {
  it('should store and return NR50 (0xFF24)', () => {
    const chip = new SoundChip();
    chip.writeRegister(0xFF24, 0x77);
    expect(chip.readRegister(0xFF24)).toBe(0x77);
  });
  it('should store and return NR51 (0xFF25)', () => {
    const chip = new SoundChip();
    chip.writeRegister(0xFF25, 0xF3);
    expect(chip.readRegister(0xFF25)).toBe(0xF3);
  });
  it('should store and return NR52 (0xFF26)', () => {
    const chip = new SoundChip();
    chip.writeRegister(0xFF26, 0xF1);
    expect(chip.readRegister(0xFF26)).toBe(0xF1);
  });
});
