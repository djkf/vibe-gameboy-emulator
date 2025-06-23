import { describe, it, expect, vi } from 'vitest';
import { MemoryBus } from './memory-bus';
import { SoundChip } from '../audio/soundchip';

describe('MemoryBus - SoundChip Integration', () => {
  it('routes writes in 0xFF10–0xFF3F to SoundChip', () => {
    const soundChip = new SoundChip();
    const memory = new MemoryBus();
    // @ts-ignore - inject soundChip for test
    memory.soundChip = soundChip;
    const spy = vi.spyOn(soundChip, 'writeRegister');
    // Write to NR10 (0xFF10)
    memory.write8(0xFF10, 0xAB);
    expect(spy).toHaveBeenCalledWith(0xFF10, 0xAB);
    // Write to NR50 (0xFF24)
    memory.write8(0xFF24, 0xCD);
    expect(spy).toHaveBeenCalledWith(0xFF24, 0xCD);
    // Write outside range should not call
    spy.mockClear();
    memory.write8(0xFF00, 0x12);
    expect(spy).not.toHaveBeenCalled();
  });
});
