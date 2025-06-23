import { describe, it, expect } from 'vitest';
import { WaveChannel } from './wave-channel';

describe('WaveChannel', () => {
  it('should store and return NR30 (sound on/off)', () => {
    const ch = new WaveChannel();
    ch.writeRegister(0xFF1A, 0x7F);
    expect(ch.readRegister(0xFF1A)).toBe(0x7F);
  });
  it('should store and return NR31 (length)', () => {
    const ch = new WaveChannel();
    ch.writeRegister(0xFF1B, 0xFF);
    expect(ch.readRegister(0xFF1B)).toBe(0xFF);
  });
  it('should store and return NR32 (output level)', () => {
    const ch = new WaveChannel();
    ch.writeRegister(0xFF1C, 0x9F);
    expect(ch.readRegister(0xFF1C)).toBe(0x9F);
  });
  it('should store and return NR33/NR34 (frequency)', () => {
    const ch = new WaveChannel();
    ch.writeRegister(0xFF1D, 0xAA);
    ch.writeRegister(0xFF1E, 0xBF);
    expect(ch.readRegister(0xFF1D)).toBe(0xAA);
    expect(ch.readRegister(0xFF1E)).toBe(0xBF);
  });
});
