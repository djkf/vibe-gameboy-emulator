import { SquareWaveChannel } from './square-wave-channel';
import { SquareWaveChannel2 } from './square-wave-channel2';
import { WaveChannel } from './wave-channel';
import { NoiseChannel } from './noise-channel';

export class SoundChip {
  channel1: SquareWaveChannel;
  channel2: SquareWaveChannel2;
  channel3: WaveChannel;
  channel4: NoiseChannel;
  private globalRegisters: Record<number, number> = {};
  private audioCtx: AudioContext | null = null;
  private scriptNode: ScriptProcessorNode | null = null;
  private sampleRate = 48000; // Standard audio sample rate
  private bufferSize = 256; // Lower buffer size for less latency
  private frameSeqCounter = 0;
  private channelPhases = [0, 0, 0, 0];
  private prevFilteredSample = 0; // For low-pass filter

  constructor() {
    this.channel1 = new SquareWaveChannel();
    this.channel2 = new SquareWaveChannel2();
    this.channel3 = new WaveChannel();
    this.channel4 = new NoiseChannel();
  }

  writeRegister(address: number, value: number): void {
    // Channel 1: 0xFF10–0xFF14
    if (address >= 0xFF10 && address <= 0xFF14) {
      this.channel1.writeRegister(address, value);
      return;
    }
    // Channel 2: 0xFF16–0xFF19
    if (address >= 0xFF16 && address <= 0xFF19) {
      this.channel2.writeRegister(address, value);
      return;
    }
    // Channel 3: 0xFF1A–0xFF1E
    if (address >= 0xFF1A && address <= 0xFF1E) {
      this.channel3.writeRegister(address, value);
      return;
    }
    // Channel 4: 0xFF20–0xFF23
    if (address >= 0xFF20 && address <= 0xFF23) {
      this.channel4.writeRegister(address, value);
      return;
    }
    // Global sound registers: 0xFF24–0xFF26
    if (address >= 0xFF24 && address <= 0xFF26) {
      this.globalRegisters[address] = value & 0xFF;
      return;
    }
  }

  readRegister(address: number): number {
    // Global sound registers: 0xFF24–0xFF26
    if (address >= 0xFF24 && address <= 0xFF26) {
      return this.globalRegisters[address] ?? 0;
    }
    return 0;
  }

  startAudio() {
    if (this.audioCtx) return;
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: this.sampleRate });
    this.scriptNode = this.audioCtx.createScriptProcessor(this.bufferSize, 0, 1);
    this.prevFilteredSample = 0; // Reset filter state on start
    this.scriptNode.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      const a = 0.25; // Smoothing factor for low-pass filter (increased for better low frequency response)
      for (let i = 0; i < output.length; i++) {
        if (++this.frameSeqCounter >= this.sampleRate / 512) {
          this.channel1.stepFrameSequencer();
          this.channel2.stepFrameSequencer();
          this.channel3.stepFrameSequencer();
          this.channel4.stepFrameSequencer();
          this.frameSeqCounter = 0;
        }
        let sample = 0;
        sample += this.channel1.sample(this.channelPhases[0], this.sampleRate);
        sample += this.channel2.sample(this.channelPhases[1], this.sampleRate);
        sample += this.channel3.sample(this.channelPhases[2], this.sampleRate);
        sample += this.channel4.sample(this.channelPhases[3], this.sampleRate);
        // Apply low-pass filter
        this.prevFilteredSample = a * sample + (1 - a) * this.prevFilteredSample;
        output[i] = this.prevFilteredSample;
        this.channelPhases[0]++;
        this.channelPhases[1]++;
        this.channelPhases[2]++;
        this.channelPhases[3]++;
      }
    };
    this.scriptNode.connect(this.audioCtx.destination);
  }

  stopAudio() {
    if (this.scriptNode) this.scriptNode.disconnect();
    if (this.audioCtx) this.audioCtx.close();
    this.audioCtx = null;
    this.scriptNode = null;
  }
}
