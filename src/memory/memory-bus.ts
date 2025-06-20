import { Joypad } from '../input/joypad';

/**
 * Game Boy Memory Bus
 * Manages memory mapping and routing for the Game Boy's 16-bit address space
 * 
 * Memory Map:
 * 0x0000-0x7FFF: ROM (32KB) - Cartridge ROM
 * 0x8000-0x9FFF: VRAM (8KB) - Video RAM
 * 0xA000-0xBFFF: External RAM (8KB) - Cartridge RAM
 * 0xC000-0xDFFF: Work RAM (8KB) - Internal RAM
 * 0xE000-0xFDFF: Echo RAM (mirror of 0xC000-0xDDFF)
 * 0xFE00-0xFE9F: OAM (Object Attribute Memory) - Sprite data
 * 0xFEA0-0xFEFF: Unused
 * 0xFF00-0xFF7F: I/O Registers
 * 0xFF80-0xFFFE: High RAM (Zero Page)
 * 0xFFFF: Interrupt Enable Register
 */
export class MemoryBus {
  // Memory regions as Uint8Array for performance
  private rom = new Uint8Array(0x8000);      // 0x0000-0x7FFF (32KB)
  private vram = new Uint8Array(0x2000);     // 0x8000-0x9FFF (8KB) 
  private extRam = new Uint8Array(0x2000);   // 0xA000-0xBFFF (8KB)
  private workRam = new Uint8Array(0x2000);  // 0xC000-0xDFFF (8KB)
  private oam = new Uint8Array(0xA0);        // 0xFE00-0xFE9F (160 bytes)
  private ioRegisters = new Uint8Array(0x80); // 0xFF00-0xFF7F (128 bytes)
  private highRam = new Uint8Array(0x7F);    // 0xFF80-0xFFFE (127 bytes)
  private interruptEnable = 0x00;            // 0xFFFF
  
  // Input handling
  private joypad = new Joypad();

  // Timer state
  private dividerCounter = 0;  // Internal 16-bit counter for DIV register
  private timerCounter = 0;    // Internal counter for TIMA

  constructor() {
    // Initialize interrupt enable register to enable V-blank interrupt
    this.interruptEnable = 0x01; // V-blank interrupt enabled
    
    // Initialize key I/O registers to post-boot state
    this.ioRegisters[0x00] = 0xCF; // Joypad register - no buttons pressed
    this.ioRegisters[0x01] = 0x00; // Serial transfer data
    this.ioRegisters[0x02] = 0x00; // Serial transfer control
    this.ioRegisters[0x04] = 0x00; // Divider register
    this.ioRegisters[0x05] = 0x00; // Timer counter
    this.ioRegisters[0x06] = 0x00; // Timer modulo
    this.ioRegisters[0x07] = 0x00; // Timer control
    this.ioRegisters[0x0F] = 0x00; // Interrupt flag
    this.ioRegisters[0x40] = 0x91; // LCD control
    this.ioRegisters[0x41] = 0x00; // LCD status
    this.ioRegisters[0x42] = 0x00; // Scroll Y
    this.ioRegisters[0x43] = 0x00; // Scroll X
    this.ioRegisters[0x44] = 0x00; // LY register
    this.ioRegisters[0x45] = 0x00; // LYC register
    this.ioRegisters[0x47] = 0xFC; // Background palette
  }

  /**
   * Read an 8-bit value from memory
   */
  read8(address: number): number {
    address = address & 0xFFFF; // Wrap to 16-bit

    if (address < 0x8000) {
      // ROM region (0x0000-0x7FFF)
      return this.rom[address];
    } else if (address < 0xA000) {
      // VRAM region (0x8000-0x9FFF)
      return this.vram[address - 0x8000];
    } else if (address < 0xC000) {
      // External RAM region (0xA000-0xBFFF)
      return this.extRam[address - 0xA000];
    } else if (address < 0xE000) {
      // Work RAM region (0xC000-0xDFFF)
      return this.workRam[address - 0xC000];
    } else if (address < 0xFE00) {
      // Echo RAM (0xE000-0xFDFF) - mirrors 0xC000-0xDDFF
      return this.workRam[address - 0xE000];
    } else if (address < 0xFEA0) {
      // OAM region (0xFE00-0xFE9F)
      return this.oam[address - 0xFE00];
    } else if (address < 0xFF00) {
      // Unused region (0xFEA0-0xFEFF)
      return 0xFF; // Reads as 0xFF
    } else if (address < 0xFF80) {
      // I/O Registers (0xFF00-0xFF7F)
      if (address === 0xFF00) {
        // Joypad register - test new implementation
        const joypadValue = this.joypad.readP1();
        // For safety, ensure it behaves like the old safe default unless buttons are actually being used
        return joypadValue;
      } else if (address === 0xFF04) {
        // DIV register - returns upper 8 bits of 16-bit counter
        const divValue = (this.dividerCounter >> 8) & 0xFF;
        return divValue;
      } else if (address === 0xFF05) {
        // TIMA register
        return this.ioRegisters[0x05];
      } else if (address === 0xFF06) {
        // TMA register
        return this.ioRegisters[0x06];
      } else if (address === 0xFF07) {
        // TAC register
        return this.ioRegisters[0x07];
      }
      return this.ioRegisters[address - 0xFF00];
    } else if (address < 0xFFFF) {
      // High RAM (0xFF80-0xFFFE)
      return this.highRam[address - 0xFF80];
    } else {
      // Interrupt Enable Register (0xFFFF)
      return this.interruptEnable;
    }
  }

  /**
   * Write an 8-bit value to memory
   */
  write8(address: number, value: number): void {
    address = address & 0xFFFF; // Wrap to 16-bit
    value = value & 0xFF; // Ensure 8-bit value

    if (address < 0x8000) {
      // ROM region (0x0000-0x7FFF) - ignore writes for now
      // TODO: Handle MBC register writes later
      return;
    } else if (address < 0xA000) {
      // VRAM region (0x8000-0x9FFF)
      this.vram[address - 0x8000] = value;
    } else if (address < 0xC000) {
      // External RAM region (0xA000-0xBFFF)
      this.extRam[address - 0xA000] = value;
    } else if (address < 0xE000) {
      // Work RAM region (0xC000-0xDFFF)
      this.workRam[address - 0xC000] = value;
    } else if (address < 0xFE00) {
      // Echo RAM (0xE000-0xFDFF) - mirrors 0xC000-0xDDFF
      this.workRam[address - 0xE000] = value;
    } else if (address < 0xFEA0) {
      // OAM region (0xFE00-0xFE9F)
      if (value !== 0) {
        console.log(`OAM write (non-zero): 0x${address.toString(16)} = 0x${value.toString(16)}`);
      }
      this.oam[address - 0xFE00] = value;
    } else if (address < 0xFF00) {
      // Unused region (0xFEA0-0xFEFF) - ignore writes
      return;
    } else if (address < 0xFF80) {
      // I/O Registers (0xFF00-0xFF7F)
      if (address === 0xFF00) {
        // Joypad register - enable writes to test selection
        this.joypad.writeP1(value);
      } else if (address === 0xFF04) {
        // DIV register - writing any value resets it to 0
        this.dividerCounter = 0;
      } else if (address === 0xFF05) {
        // TIMA register
        this.ioRegisters[0x05] = value;
      } else if (address === 0xFF06) {
        // TMA register
        this.ioRegisters[0x06] = value;
      } else if (address === 0xFF07) {
        // TAC register - timer control
        this.ioRegisters[0x07] = value & 0x07; // Only lower 3 bits are used
      } else if (address === 0xFF46) {
        // OAM DMA register - trigger DMA transfer
        this.handleOAMDMA(value);
      }
      this.ioRegisters[address - 0xFF00] = value;
    } else if (address < 0xFFFF) {
      // High RAM (0xFF80-0xFFFE)
      this.highRam[address - 0xFF80] = value;
    } else {
      // Interrupt Enable Register (0xFFFF)
      this.interruptEnable = value;
    }
  }

  /**
   * Read a 16-bit value from memory (little-endian)
   */
  read16(address: number): number {
    const low = this.read8(address);
    const high = this.read8(address + 1);
    return (high << 8) | low;
  }

  /**
   * Write a 16-bit value to memory (little-endian)
   */
  write16(address: number, value: number): void {
    this.write8(address, value & 0xFF);         // Low byte
    this.write8(address + 1, (value >> 8) & 0xFF); // High byte
  }

  /**
   * Load ROM data into the ROM region
   * @param romData The ROM data as Uint8Array
   */
  loadRom(romData: Uint8Array): void {
    const size = Math.min(romData.length, this.rom.length);
    this.rom.set(romData.subarray(0, size));
  }

  /**
   * Set joypad button state
   */
  setJoypadButton(button: string, pressed: boolean): void {
    this.joypad.setButton(button, pressed);
  }

  /**
   * Handle OAM DMA transfer
   * @param sourcePageHighByte The high byte of the source address (0x00-0xDF)
   */
  private handleOAMDMA(sourcePageHighByte: number): void {
    // DMA transfers 160 bytes (40 sprites * 4 bytes each) from source to OAM
    const sourceAddress = sourcePageHighByte << 8; // e.g., 0xC1 becomes 0xC100
    
    // Copy 160 bytes from source to OAM (0xFE00-0xFE9F)
    for (let i = 0; i < 160; i++) {
      const sourceData = this.read8(sourceAddress + i);
      this.oam[i] = sourceData;
    }
  }

  /**
   * Update timer registers based on CPU cycles
   * Should be called every CPU cycle
   */
  updateTimers(cycles: number): void {
    // Update DIV register (always runs at 16384 Hz = CPU_FREQ / 256)
    // Add some variation to make it more realistic for RNG
    const variation = Math.random() < 0.1 ? 1 : 0; // 10% chance of extra increment
    this.dividerCounter += cycles + variation;
    
    // Wrap around at 16-bit boundary for more realistic behavior
    if (this.dividerCounter >= 65536) {
      this.dividerCounter -= 65536;
    }

    // Update TIMA if timer is enabled
    const tac = this.ioRegisters[0x07];
    const timerEnabled = (tac & 0x04) !== 0;
    
    if (timerEnabled) {
      const timerFreq = this.getTimerFrequency(tac & 0x03);
      this.timerCounter += cycles;
      
      while (this.timerCounter >= timerFreq) {
        this.timerCounter -= timerFreq;
        
        // Increment TIMA
        let tima = this.ioRegisters[0x05];
        tima++;
        
        if (tima > 0xFF) {
          // TIMA overflow - reload with TMA and request timer interrupt
          this.ioRegisters[0x05] = this.ioRegisters[0x06]; // TMA
          this.requestInterrupt(2); // Timer interrupt bit 2
        } else {
          this.ioRegisters[0x05] = tima;
        }
      }
    }
  }

  /**
   * Get timer frequency based on TAC bits 0-1
   */
  private getTimerFrequency(tacBits: number): number {
    switch (tacBits) {
      case 0: return 1024; // 4096 Hz
      case 1: return 16;   // 262144 Hz
      case 2: return 64;   // 65536 Hz
      case 3: return 256;  // 16384 Hz
      default: return 1024;
    }
  }

  /**
   * Request an interrupt by setting the appropriate bit in IF register (0xFF0F)
   */
  requestInterrupt(interruptBit: number): void {
    const currentFlags = this.ioRegisters[0x0F];
    this.ioRegisters[0x0F] = currentFlags | (1 << interruptBit);
  }
}
