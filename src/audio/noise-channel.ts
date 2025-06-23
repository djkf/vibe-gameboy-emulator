// NoiseChannel.ts
// Noise channel (channel 4) implementation with envelope, length, and LFSR-based noise generation
export class NoiseChannel {
  private registers: Record<number, number> = {};
  private enabled = false;
  private lengthCounter = 0;
  private envelopeVolume = 0;
  private envelopeTimer = 0;
  private lfsr = 0x7FFF;

  writeRegister(address: number, value: number): void {
    this.registers[address] = value & 0xFF;
    // NR44 (0xFF23) - trigger (bit 7)
    if (address === 0xFF23 && (value & 0x80)) {
      this.trigger();
    }
  }

  readRegister(address: number): number {
    return this.registers[address] ?? 0;
  }

  trigger() {
    this.enabled = true;
    this.lengthCounter = 64 - (this.registers[0xFF20] ?? 0) & 0x3F;
    const envelope = this.registers[0xFF21] ?? 0;
    this.envelopeVolume = (envelope >> 4) & 0x0F;
    this.envelopeTimer = (envelope & 0x07) || 8;
    this.lfsr = 0x7FFF;
  }

  stepEnvelope() {
    const envelope = this.registers[0xFF21] ?? 0;
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

  stepFrameSequencer() {
    this.stepEnvelope();
    this.stepLength();
  }

  sample(phase: number, sampleRate: number): number {
    if (!this.enabled) return 0;
    // NR43: Noise frequency
    const nr43 = this.registers[0xFF22] ?? 0;
    const s = nr43 & 0x07;
    const r = (nr43 >> 4) & 0x0F;
    const widthMode = (nr43 & 0x08) !== 0;
    // Noise frequency formula (approx):
    const divisor = s === 0 ? 0.5 : s * 2;
    const freq = 524288 / divisor / (1 << (r + 1));
    if (freq <= 0 || this.envelopeVolume === 0) return 0;
    // LFSR update per sample
    if ((phase % Math.floor(sampleRate / freq)) === 0) {
      let bit = (this.lfsr ^ (this.lfsr >> 1)) & 1;
      this.lfsr = (this.lfsr >> 1) | (bit << 14);
      if (widthMode) this.lfsr = (this.lfsr & ~(1 << 6)) | (bit << 6);
    }
    const value = (~this.lfsr) & 1 ? 1 : -1;
    return value * (this.envelopeVolume / 15) * 0.25;
  }
}
