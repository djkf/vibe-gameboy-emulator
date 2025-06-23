import { describe, it, expect } from 'vitest';
import { NoiseChannel } from './noise-channel';

describe('NoiseChannel', () => {
  it('should store and return NR41 (length)', () => {
    const ch = new NoiseChannel();
    ch.writeRegister(0xFF20, 0xFF);
    expect(ch.readRegister(0xFF20)).toBe(0xFF);
  });
  it('should store and return NR42 (envelope)', () => {
    const ch = new NoiseChannel();
    ch.writeRegister(0xFF21, 0xF3);
    expect(ch.readRegister(0xFF21)).toBe(0xF3);
  });
  it('should store and return NR43 (polynomial counter)', () => {
    const ch = new NoiseChannel();
    ch.writeRegister(0xFF22, 0xAA);
    expect(ch.readRegister(0xFF22)).toBe(0xAA);
  });
  it('should store and return NR44 (control)', () => {
    const ch = new NoiseChannel();
    ch.writeRegister(0xFF23, 0xBF);
    expect(ch.readRegister(0xFF23)).toBe(0xBF);
  });
});
