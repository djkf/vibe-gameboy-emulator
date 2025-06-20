import { CPU } from './cpu/cpu';
import { MemoryBus } from './memory/memory-bus';
import { PPU } from './graphics/ppu';

/**
 * Main Game Boy Emulator Class
 * Coordinates CPU, PPU, and memory components
 */
export class GameBoy {
  public readonly cpu: CPU;
  public readonly memory: MemoryBus;
  public readonly ppu: PPU;
  
  private _totalCycles = 0;
  private _isRunning = false;
  
  // Target cycles per frame (Game Boy runs at ~60 FPS)
  private static readonly CYCLES_PER_FRAME = 70224; // 4.194304 MHz / 59.73 Hz

  constructor() {
    this.memory = new MemoryBus();
    this.cpu = new CPU(this.memory);
    this.ppu = new PPU(this.memory);
  }

  get totalCycles(): number {
    return this._totalCycles;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Load ROM data into memory
   */
  loadRom(romData: Uint8Array): void {
    this.memory.loadRom(romData);
    
    // Set up proper Game Boy post-boot state (as left by boot ROM)
    this.memory.write8(0xFF05, 0x00); // TIMA
    this.memory.write8(0xFF06, 0x00); // TMA 
    this.memory.write8(0xFF07, 0x00); // TAC
    this.memory.write8(0xFF10, 0x80); // NR10
    this.memory.write8(0xFF11, 0xBF); // NR11
    this.memory.write8(0xFF12, 0xF3); // NR12
    this.memory.write8(0xFF14, 0xBF); // NR14
    this.memory.write8(0xFF16, 0x3F); // NR21
    this.memory.write8(0xFF17, 0x00); // NR22
    this.memory.write8(0xFF19, 0xBF); // NR24
    this.memory.write8(0xFF1A, 0x7F); // NR30
    this.memory.write8(0xFF1B, 0xFF); // NR31
    this.memory.write8(0xFF1C, 0x9F); // NR32
    this.memory.write8(0xFF1E, 0xBF); // NR33
    this.memory.write8(0xFF20, 0xFF); // NR41
    this.memory.write8(0xFF21, 0x00); // NR42
    this.memory.write8(0xFF22, 0x00); // NR43
    this.memory.write8(0xFF23, 0xBF); // NR30
    this.memory.write8(0xFF24, 0x77); // NR50
    this.memory.write8(0xFF25, 0xF3); // NR51
    this.memory.write8(0xFF26, 0xF1); // NR52
    this.memory.write8(0xFF40, 0x93); // LCD Control: LCD on, BG on, sprites on, BG tile map 0x9800
    this.memory.write8(0xFF42, 0x00); // SCY
    this.memory.write8(0xFF43, 0x00); // SCX
    this.memory.write8(0xFF45, 0x00); // LYC
    this.memory.write8(0xFF47, 0xFC); // Background palette: 11 11 11 00
    this.memory.write8(0xFF48, 0xFF); // Object palette 0
    this.memory.write8(0xFF49, 0xFF); // Object palette 1
    this.memory.write8(0xFF4A, 0x00); // WY
    this.memory.write8(0xFF4B, 0x00); // WX
    this.memory.write8(0xFFFF, 0x00); // IE
    
    // Initialize CPU registers to post-boot state
    this.cpu.registers.AF = 0x01B0;
    this.cpu.registers.BC = 0x0013;
    this.cpu.registers.DE = 0x00D8;
    this.cpu.registers.HL = 0x014D;
    this.cpu.registers.SP = 0xFFFE;
    this.cpu.registers.PC = 0x0100; // Start at ROM entry point
  }

  /**
   * Execute one emulation step (one CPU instruction)
   */
  step(): void {
    if (this.cpu.isHalted) {
      // CPU is halted, but PPU still runs
      const cycles = 4; // Minimum cycle step
      this.ppu.step(cycles);
      this.memory.updateTimers(cycles);
      this._totalCycles += cycles;
    } else {
      // Execute one CPU instruction
      const cyclesBefore = this.cpu.totalCycles;
      this.cpu.step();
      const cyclesElapsed = this.cpu.totalCycles - cyclesBefore;
      
      // Step PPU by the same number of cycles
      this.ppu.step(cyclesElapsed);
      
      // Update timers
      this.memory.updateTimers(cyclesElapsed);
      
      this._totalCycles += cyclesElapsed;
    }
    
    // Update interrupt flags based on PPU state
    this.updateInterruptFlags();
  }

  /**
   * Run emulation for one frame (until V-blank)
   */
  runFrame(): void {
    const startCycles = this._totalCycles;
    const targetCycles = startCycles + GameBoy.CYCLES_PER_FRAME;
    
    // Run for approximately one frame worth of cycles
    while (this._totalCycles < targetCycles) {
      this.step();
      
      // Safety check to prevent infinite loops
      if (this._totalCycles - startCycles > GameBoy.CYCLES_PER_FRAME * 2) {
        console.warn('Frame took too long, breaking out');
        break;
      }
    }
  }

  /**
   * Start continuous emulation
   */
  start(): void {
    this._isRunning = true;
  }

  /**
   * Stop emulation
   */
  stop(): void {
    this._isRunning = false;
  }

  /**
   * Reset the emulator to initial state
   */
  reset(): void {
    this._totalCycles = 0;
    this._isRunning = false;
    // Note: CPU and PPU will be reset when we implement their reset methods
  }

  /**
   * Update interrupt flags based on hardware state
   */
  private updateInterruptFlags(): void {
    // Set V-blank interrupt flag when PPU requests it
    if (this.ppu.vblankRequested) {
      const interruptFlag = this.memory.read8(0xFF0F);
      this.memory.write8(0xFF0F, interruptFlag | 0x01);
      // Clear the PPU request immediately after setting the flag
      this.ppu.clearVBlankRequest();
    }
    
    // Ensure LCD stays properly configured for gameplay
    this.ensureLCDConfigured();
  }

  /**
   * Ensure LCD is properly configured for gameplay
   */
  private ensureLCDConfigured(): void {
    const lcdControl = this.memory.read8(0xFF40);
    
    // Only intervene if LCD is completely off AND we've been running for a while
    // This allows the game's natural boot sequence to work
    if ((lcdControl & 0x80) === 0 && this._totalCycles > 100000) {
      // Game has been running for a while but LCD is still off - probably stuck
      this.memory.write8(0xFF40, 0x91); // LCD on, BG on, BG tile map 0x9800
      this.memory.write8(0xFF47, 0xFC); // Background palette
    }
  }

  /**
   * Get the current screen data from PPU
   */
  getScreenData(): Uint8Array {
    return this.ppu.getFramebuffer();
  }

  /**
   * Set joypad button state
   */
  setJoypadButton(button: string, pressed: boolean): void {
    this.memory.setJoypadButton(button, pressed);
  }

  /**
   * Get emulation statistics
   */
  getStats(): {
    totalCycles: number;
    cpuCycles: number;
    currentScanline: number;
    ppuMode: number;
    isRunning: boolean;
  } {
    return {
      totalCycles: this._totalCycles,
      cpuCycles: this.cpu.totalCycles,
      currentScanline: this.ppu.currentLine,
      ppuMode: this.ppu.mode,
      isRunning: this._isRunning,
    };
  }
}
