// SquareWaveChannel.ts
// Square wave channel with sweep and envelope

// Duty patterns: 12.5%, 25%, 50%, 75% (moved outside for efficiency)
const dutyTable = [0.125, 0.25, 0.5, 0.75];

// Register offsets for channel 1
const REG_NR10 = 0; // 0xFF10
const REG_NR11 = 1; // 0xFF11
const REG_NR12 = 2; // 0xFF12
const REG_NR13 = 3; // 0xFF13
const REG_NR14 = 4; // 0xFF14

export class SquareWaveChannel {
  private registers = new Uint8Array(5); // 0xFF10-0xFF14
  private enabled = false;
  private lengthCounter = 0;
  private envelopeVolume = 0;
  private envelopeTimer = 0;
  private sweepTimer = 0;
  private sweepShadowFreq = 0;

  // All register access is O(1) via this.registers[REG_*]
  writeRegister(address: number, value: number): void {
    const offset = address - 0xFF10;
    if (offset < 0 || offset >= this.registers.length) return;
    this.registers[offset] = value & 0xFF;
    // NR10 (0xFF10) - sweep register
    if (offset === REG_NR10) {
      // Reset sweep timer if needed
      this.sweepTimer = ((value >> 4) & 0x07) || 8;
    }
    // NR14 (0xFF14) - trigger (bit 7)
    if (offset === REG_NR14 && (value & 0x80)) {
      this.trigger();
    }
  }

  readRegister(address: number): number {
    const offset = address - 0xFF10;
    if (offset < 0 || offset >= this.registers.length) return 0;
    return this.registers[offset];
  }

  trigger() {
    this.enabled = true;
    // Length counter: 64 - (lower 6 bits of NR11)
    this.lengthCounter = 64 - (this.registers[REG_NR11] & 0x3F);
    // Envelope
    const envelope = this.registers[REG_NR12];
    this.envelopeVolume = (envelope >> 4) & 0x0F;
    this.envelopeTimer = (envelope & 0x07) || 8;
    // Sweep
    this.sweepShadowFreq = ((this.registers[REG_NR14] & 0x07) << 8) | this.registers[REG_NR13];
    this.sweepTimer = ((this.registers[REG_NR10] >> 4) & 0x07) || 8;
  }

  stepSweep() {
    const sweep = this.registers[REG_NR10];
    const period = (sweep >> 4) & 0x07;
    const shift = sweep & 0x07;
    const negate = (sweep & 0x08) !== 0;
    if (period === 0) return;
    if (--this.sweepTimer === 0) {
      this.sweepTimer = period || 8;
      if (shift > 0) {
        let newFreq = this.sweepShadowFreq >> shift;
        if (negate) newFreq = this.sweepShadowFreq - newFreq;
        else newFreq = this.sweepShadowFreq + newFreq;
        if (newFreq > 2047) {
          this.enabled = false;
        } else {
          this.sweepShadowFreq = newFreq;
          // Write back to NR13/NR14
          this.registers[REG_NR13] = newFreq & 0xFF;
          this.registers[REG_NR14] = (this.registers[REG_NR14] & 0xF8) | ((newFreq >> 8) & 0x07);
        }
      }
    }
  }

  stepEnvelope() {
    // Envelope sweep logic (not full, but basic)
    const envelope = this.registers[REG_NR12];
    const direction = (envelope & 0x08) ? 1 : -1;
    const period = envelope & 0x07;
    if (period && this.envelopeTimer-- === 0) {
      this.envelopeTimer = period;
      let newVol = this.envelopeVolume + direction;
      if (newVol >= 0 && newVol <= 15) this.envelopeVolume = newVol;
    }
  }

  stepLength() {
    if (this.lengthCounter > 0) {
      this.lengthCounter--;
      if (this.lengthCounter === 0) this.enabled = false;
    }
  }

  // Called by SoundChip to advance envelope/length (should be called at 64Hz frame sequencer rate)
  stepFrameSequencer() {
    this.stepSweep();
    this.stepEnvelope();
    this.stepLength();
  }

  // Square wave sample generator using register values (all O(1) array access)
  sample(phase: number, sampleRate: number): number {
    if (!this.enabled) return 0;
    // Use sweepShadowFreq for frequency if sweep is active
    let freqLow = this.registers[REG_NR13];
    let freqHigh = this.registers[REG_NR14];
    let freqRaw = ((freqHigh & 0x07) << 8) | freqLow;
    if (this.sweepShadowFreq) freqRaw = this.sweepShadowFreq;
    // Game Boy formula: freq = 131072 / (2048 - freqRaw)
    const freq = freqRaw < 2048 ? 131072 / (2048 - freqRaw) : 0;
    if (freq <= 0 || this.envelopeVolume === 0) return 0;
    const period = sampleRate / freq;
    // NR11 (0xFF11): Duty
    const duty = this.registers[REG_NR11] >> 6;
    const highTime = period * dutyTable[duty];
    const value = (phase % period) < highTime ? 1 : -1;
    // Scale by volume (max 0.25 for headroom)
    return value * (this.envelopeVolume / 15) * 0.25;
  }
}
