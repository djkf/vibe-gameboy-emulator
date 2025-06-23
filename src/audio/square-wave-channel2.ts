// SquareWaveChannel2.ts
// Minimal stub for channel 2 (square wave with envelope)
export class SquareWaveChannel2 {
  private registers: Record<number, number> = {};
  private enabled = false;
  private lengthCounter = 0;
  private envelopeVolume = 0;
  private envelopeTimer = 0;

  writeRegister(address: number, value: number): void {
    this.registers[address] = value & 0xFF;
    // NR24 (0xFF19) - trigger (bit 7)
    if (address === 0xFF19 && (value & 0x80)) {
      this.trigger();
    }
  }

  readRegister(address: number): number {
    return this.registers[address] ?? 0;
  }

  trigger() {
    this.enabled = true;
    // Length counter: 64 - (lower 6 bits of NR21)
    this.lengthCounter = 64 - (this.registers[0xFF16] ?? 0) & 0x3F;
    // Envelope
    const envelope = this.registers[0xFF17] ?? 0;
    this.envelopeVolume = (envelope >> 4) & 0x0F;
    this.envelopeTimer = (envelope & 0x07) || 8;
  }

  stepEnvelope() {
    const envelope = this.registers[0xFF17] ?? 0;
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
    // NR17 (0xFF17): Envelope (volume)
    const initialVolume = this.envelopeVolume;
    // NR23/NR24: Frequency
    const freqLow = this.registers[0xFF18] ?? 0;
    const freqHigh = this.registers[0xFF19] ?? 0;
    const freqRaw = ((freqHigh & 0x07) << 8) | freqLow;
    const freq = freqRaw < 2048 ? 131072 / (2048 - freqRaw) : 0;
    if (freq <= 0 || initialVolume === 0) return 0;
    const period = sampleRate / freq;
    // NR21 (0xFF16): Duty
    const duty = (this.registers[0xFF16] ?? 0) >> 6;
    const dutyTable = [0.125, 0.25, 0.5, 0.75];
    const highTime = period * dutyTable[duty];
    const value = (phase % period) < highTime ? 1 : -1;
    return value * (initialVolume / 15) * 0.25;
  }
}
