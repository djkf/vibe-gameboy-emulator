/**
 * Game Boy CPU Registers
 * Manages the LR35902's 8-bit and 16-bit registers, flags, PC, and SP
 */

// Register indices
const REG_A = 0;
const REG_B = 1;
const REG_C = 2;
const REG_D = 3;
const REG_E = 4;
const REG_H = 5;
const REG_L = 6;
const REG_F = 7; // Flags register (Z N H C in upper 4 bits)

export class Registers {
  // 8-bit registers and flags in a single Uint8Array
  private regs = new Uint8Array(8); // [A, B, C, D, E, H, L, F]
  // 16-bit registers
  private _PC = 0x0100; // Program Counter - post-boot state (cartridge entry)
  private _SP = 0xFFFE; // Stack Pointer - post-boot state

  constructor() {
    // Post-boot state
    this.regs[REG_A] = 0x01;
    this.regs[REG_B] = 0x00;
    this.regs[REG_C] = 0x13;
    this.regs[REG_D] = 0x00;
    this.regs[REG_E] = 0xD8;
    this.regs[REG_H] = 0x01;
    this.regs[REG_L] = 0x4D;
    this.regs[REG_F] = 0xB0; // Z=1, N=0, H=1, C=1 (bits 7,5,4)
  }

  // 8-bit register accessors
  get A(): number { return this.regs[REG_A]; }
  set A(value: number) { this.regs[REG_A] = value & 0xFF; }

  get B(): number { return this.regs[REG_B]; }
  set B(value: number) { this.regs[REG_B] = value & 0xFF; }

  get C(): number { return this.regs[REG_C]; }
  set C(value: number) { this.regs[REG_C] = value & 0xFF; }

  get D(): number { return this.regs[REG_D]; }
  set D(value: number) { this.regs[REG_D] = value & 0xFF; }

  get E(): number { return this.regs[REG_E]; }
  set E(value: number) { this.regs[REG_E] = value & 0xFF; }

  get H(): number { return this.regs[REG_H]; }
  set H(value: number) { this.regs[REG_H] = value & 0xFF; }

  get L(): number { return this.regs[REG_L]; }
  set L(value: number) { this.regs[REG_L] = value & 0xFF; }

  // Flags as F register (bits 7-4, lower bits always 0)
  get F(): number { return this.regs[REG_F] & 0xF0; }
  set F(value: number) { this.regs[REG_F] = value & 0xF0; }

  // Flag accessors
  get flagZ(): boolean { return (this.regs[REG_F] & 0x80) !== 0; }
  set flagZ(value: boolean) { this.regs[REG_F] = value ? (this.regs[REG_F] | 0x80) : (this.regs[REG_F] & ~0x80); }

  get flagN(): boolean { return (this.regs[REG_F] & 0x40) !== 0; }
  set flagN(value: boolean) { this.regs[REG_F] = value ? (this.regs[REG_F] | 0x40) : (this.regs[REG_F] & ~0x40); }

  get flagH(): boolean { return (this.regs[REG_F] & 0x20) !== 0; }
  set flagH(value: boolean) { this.regs[REG_F] = value ? (this.regs[REG_F] | 0x20) : (this.regs[REG_F] & ~0x20); }

  get flagC(): boolean { return (this.regs[REG_F] & 0x10) !== 0; }
  set flagC(value: boolean) { this.regs[REG_F] = value ? (this.regs[REG_F] | 0x10) : (this.regs[REG_F] & ~0x10); }

  // 16-bit register pair accessors
  get BC(): number { return (this.regs[REG_B] << 8) | this.regs[REG_C]; }
  set BC(value: number) {
    this.regs[REG_B] = (value >> 8) & 0xFF;
    this.regs[REG_C] = value & 0xFF;
  }

  get DE(): number { return (this.regs[REG_D] << 8) | this.regs[REG_E]; }
  set DE(value: number) {
    this.regs[REG_D] = (value >> 8) & 0xFF;
    this.regs[REG_E] = value & 0xFF;
  }

  get HL(): number { return (this.regs[REG_H] << 8) | this.regs[REG_L]; }
  set HL(value: number) {
    this.regs[REG_H] = (value >> 8) & 0xFF;
    this.regs[REG_L] = value & 0xFF;
  }

  get AF(): number { return (this.regs[REG_A] << 8) | this.F; }
  set AF(value: number) {
    this.regs[REG_A] = (value >> 8) & 0xFF;
    this.F = value & 0xF0;
  }

  // Program Counter and Stack Pointer
  get PC(): number { return this._PC; }
  set PC(value: number) { this._PC = value & 0xFFFF; }

  get SP(): number { return this._SP; }
  set SP(value: number) { this._SP = value & 0xFFFF; }
}
