// WaveChannel.ts
// Channel 3 (programmable waveform) implementation
export class WaveChannel {
  private registers: Record<number, number> = {};
  private enabled = false;
  private lengthCounter = 0;
  private volumeShift = 0;
  private waveTable = new Uint8Array(32); // 32 4-bit samples
  private sampleIndex = 0;

  writeRegister(address: number, value: number): void {
    this.registers[address] = value & 0xFF;
    // NR30 (0xFF1A) - sound on/off
    if (address === 0xFF1A) {
      this.enabled = !!(value & 0x80);
    }
    // NR34 (0xFF1E) - trigger (bit 7)
    if (address === 0xFF1E && (value & 0x80)) {
      this.trigger();
    }
    // Wave RAM (0xFF30–0xFF3F)
    if (address >= 0xFF30 && address <= 0xFF3F) {
      const idx = address - 0xFF30;
      this.waveTable[idx * 2] = (value >> 4) & 0x0F;
      this.waveTable[idx * 2 + 1] = value & 0x0F;
    }
  }

  readRegister(address: number): number {
    return this.registers[address] ?? 0;
  }

  trigger() {
    this.enabled = true;
    this.lengthCounter = 256 - (this.registers[0xFF1B] ?? 0);
    this.volumeShift = ((this.registers[0xFF1C] ?? 0) >> 5) & 0x03;
    this.sampleIndex = 0;
  }

  stepLength() {
    if (this.lengthCounter > 0) {
      this.lengthCounter--;
      if (this.lengthCounter === 0) this.enabled = false;
    }
  }

  stepFrameSequencer() {
    this.stepLength();
  }

  sample(phase: number, sampleRate: number): number {
    if (!this.enabled) return 0;
    // NR33/NR34: Frequency
    const freqLow = this.registers[0xFF1D] ?? 0;
    const freqHigh = this.registers[0xFF1E] ?? 0;
    const freqRaw = ((freqHigh & 0x07) << 8) | freqLow;
    const freq = freqRaw < 2048 ? 2097152 / (2048 - freqRaw) / 2 : 0; // 2 MHz clock, /2 for sample rate
    if (freq <= 0) return 0;
    const period = sampleRate / freq;
    // 32-sample wave table
    const idx = Math.floor((phase / period) % 32);
    let sample = this.waveTable[idx] ?? 0;
    // Volume shift: 0=mute, 1=100%, 2=50%, 3=25%
    if (this.volumeShift === 0) sample = 0;
    else if (this.volumeShift === 2) sample >>= 1;
    else if (this.volumeShift === 3) sample >>= 2;
    // Scale to [-0.25, 0.25]
    return (sample / 15 - 0.5) * 0.5;
  }
}
