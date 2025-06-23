import { describe, it, expect } from 'vitest';
import { SquareWaveChannel2 } from './square-wave-channel2';

describe('SquareWaveChannel2', () => {
  it('should store and return NR21 (duty/length register)', () => {
    const ch = new SquareWaveChannel2();
    ch.writeRegister(0xFF16, 0x3F);
    expect(ch.readRegister(0xFF16)).toBe(0x3F);
  });
  it('should store and return NR22 (envelope register)', () => {
    const ch = new SquareWaveChannel2();
    ch.writeRegister(0xFF17, 0xF3);
    expect(ch.readRegister(0xFF17)).toBe(0xF3);
  });
  it('should store and return NR23/NR24 (frequency registers)', () => {
    const ch = new SquareWaveChannel2();
    ch.writeRegister(0xFF18, 0xAA);
    ch.writeRegister(0xFF19, 0xBF);
    expect(ch.readRegister(0xFF18)).toBe(0xAA);
    expect(ch.readRegister(0xFF19)).toBe(0xBF);
  });
});
