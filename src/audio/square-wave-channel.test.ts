import { describe, it, expect } from 'vitest';
import { SquareWaveChannel } from './square-wave-channel';

describe('SquareWaveChannel', () => {
  it('should store and return NR10 (sweep register)', () => {
    const ch = new SquareWaveChannel();
    ch.writeRegister(0xFF10, 0x8F);
    expect(ch.readRegister(0xFF10)).toBe(0x8F);
  });
  it('should store and return NR11 (duty/length register)', () => {
    const ch = new SquareWaveChannel();
    ch.writeRegister(0xFF11, 0x3F);
    expect(ch.readRegister(0xFF11)).toBe(0x3F);
  });
  it('should store and return NR12 (envelope register)', () => {
    const ch = new SquareWaveChannel();
    ch.writeRegister(0xFF12, 0xF3);
    expect(ch.readRegister(0xFF12)).toBe(0xF3);
  });
  it('should store and return NR13/NR14 (frequency registers)', () => {
    const ch = new SquareWaveChannel();
    ch.writeRegister(0xFF13, 0xAA);
    ch.writeRegister(0xFF14, 0xBF);
    expect(ch.readRegister(0xFF13)).toBe(0xAA);
    expect(ch.readRegister(0xFF14)).toBe(0xBF);
  });
});
