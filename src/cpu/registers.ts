/**
 * Game Boy CPU Registers
 * Manages the LR35902's 8-bit and 16-bit registers, flags, PC, and SP
 */
export class Registers {
  // 8-bit registers
  private _A = 0x01; // Accumulator - post-boot state
  private _B = 0x00;
  private _C = 0x13; // post-boot state
  private _D = 0x00;
  private _E = 0xD8; // post-boot state
  private _H = 0x01; // post-boot state
  private _L = 0x4D; // post-boot state

  // Flags
  private _flagZ = true;  // Zero flag - post-boot state
  private _flagN = false; // Negative flag
  private _flagH = true;  // Half-carry flag - post-boot state
  private _flagC = true;  // Carry flag - post-boot state

  // 16-bit registers
  private _PC = 0x0100; // Program Counter - post-boot state (cartridge entry)
  private _SP = 0xFFFE; // Stack Pointer - post-boot state

  // 8-bit register accessors
  get A(): number { return this._A; }
  set A(value: number) { this._A = value & 0xFF; }

  get B(): number { return this._B; }
  set B(value: number) { this._B = value & 0xFF; }

  get C(): number { return this._C; }
  set C(value: number) { this._C = value & 0xFF; }

  get D(): number { return this._D; }
  set D(value: number) { this._D = value & 0xFF; }

  get E(): number { return this._E; }
  set E(value: number) { this._E = value & 0xFF; }

  get H(): number { return this._H; }
  set H(value: number) { this._H = value & 0xFF; }

  get L(): number { return this._L; }
  set L(value: number) { this._L = value & 0xFF; }

  // Flag accessors
  get flagZ(): boolean { return this._flagZ; }
  set flagZ(value: boolean) { this._flagZ = value; }

  get flagN(): boolean { return this._flagN; }
  set flagN(value: boolean) { this._flagN = value; }

  get flagH(): boolean { return this._flagH; }
  set flagH(value: boolean) { this._flagH = value; }

  get flagC(): boolean { return this._flagC; }
  set flagC(value: boolean) { this._flagC = value; }

  // Flags as F register (bits 7-4, lower bits always 0)
  get F(): number {
    return (
      (this._flagZ ? 0x80 : 0) |  // bit 7
      (this._flagN ? 0x40 : 0) |  // bit 6
      (this._flagH ? 0x20 : 0) |  // bit 5
      (this._flagC ? 0x10 : 0)    // bit 4
    );
  }

  set F(value: number) {
    this._flagZ = (value & 0x80) !== 0;
    this._flagN = (value & 0x40) !== 0;
    this._flagH = (value & 0x20) !== 0;
    this._flagC = (value & 0x10) !== 0;
  }

  // 16-bit register pair accessors
  get BC(): number { return (this._B << 8) | this._C; }
  set BC(value: number) {
    this._B = (value >> 8) & 0xFF;
    this._C = value & 0xFF;
  }

  get DE(): number { return (this._D << 8) | this._E; }
  set DE(value: number) {
    this._D = (value >> 8) & 0xFF;
    this._E = value & 0xFF;
  }

  get HL(): number { return (this._H << 8) | this._L; }
  set HL(value: number) {
    this._H = (value >> 8) & 0xFF;
    this._L = value & 0xFF;
  }

  get AF(): number { return (this._A << 8) | this.F; }
  set AF(value: number) {
    this._A = (value >> 8) & 0xFF;
    this.F = value & 0xFF;
  }

  // Program Counter and Stack Pointer
  get PC(): number { return this._PC; }
  set PC(value: number) { this._PC = value & 0xFFFF; }

  get SP(): number { return this._SP; }
  set SP(value: number) { this._SP = value & 0xFFFF; }
}
