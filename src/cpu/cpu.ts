import { Registers } from './registers';
import { MemoryBus } from '../memory/memory-bus';

// Register indices for O(1) access
const REG_A = 0;
const REG_B = 1;
const REG_C = 2;
const REG_D = 3;
const REG_E = 4;
const REG_H = 5;
const REG_L = 6;
const REG_F = 7;

/**
 * Game Boy LR35902 CPU
 * Implements the CPU with fetch-decode-execute cycle using instruction lookup table
 */
export class CPU {
  public registers: Registers;
  private memory: MemoryBus;
  private _totalCycles = 0;
  private _isHalted = false;
  private _interruptMasterEnable = false; // IME flag
  private _pendingEnableInterrupt = false; // EI delayed enable
  
  // Instruction lookup table - function for each of 256 possible opcodes
  private instructionTable: ((opcode: number) => number)[];

  constructor(memory: MemoryBus) {
    this.memory = memory;
    this.registers = new Registers();
    this.instructionTable = this.createInstructionTable();
  }

  get totalCycles(): number {
    return this._totalCycles;
  }

  get isHalted(): boolean {
    return this._isHalted;
  }

  get interruptMasterEnable(): boolean {
    return this._interruptMasterEnable;
  }

  /**
   * Check for and handle interrupts
   */
  checkInterrupts(): boolean {
    if (!this._interruptMasterEnable) {
      return false;
    }

    const interruptEnable = this.memory.read8(0xFFFF);
    const interruptFlag = this.memory.read8(0xFF0F);
    const pendingInterrupts = interruptEnable & interruptFlag;

    if (pendingInterrupts === 0) {
      return false;
    }

    // Handle interrupts in priority order
    if (pendingInterrupts & 0x01) {
      // V-blank interrupt (highest priority)
      this.handleInterrupt(0x40, 0);
      return true;
    }
    if (pendingInterrupts & 0x02) {
      // LCD STAT interrupt
      this.handleInterrupt(0x48, 1);
      return true;
    }
    if (pendingInterrupts & 0x04) {
      // Timer interrupt
      this.handleInterrupt(0x50, 2);
      return true;
    }
    if (pendingInterrupts & 0x08) {
      // Serial interrupt
      this.handleInterrupt(0x58, 3);
      return true;
    }
    if (pendingInterrupts & 0x10) {
      // Joypad interrupt
      this.handleInterrupt(0x60, 4);
      return true;
    }

    return false;
  }

  /**
   * Handle a specific interrupt
   */
  private handleInterrupt(vector: number, bitIndex: number): void {
    // Clear the interrupt flag
    const interruptFlag = this.memory.read8(0xFF0F);
    this.memory.write8(0xFF0F, interruptFlag & ~(1 << bitIndex));

    // Disable interrupts
    this._interruptMasterEnable = false;

    // If CPU was halted, wake it up
    this._isHalted = false;

    // Push PC onto stack
    this.pushStack16(this.registers.PC);

    // Jump to interrupt vector
    this.registers.PC = vector;

    // Interrupt handling takes 20 cycles
    this._totalCycles += 20;
  }

  /**
   * Push 16-bit value onto stack
   */
  private pushStack16(value: number): void {
    this.registers.SP = (this.registers.SP - 2) & 0xFFFF;
    this.memory.write16(this.registers.SP, value);
  }

  /**
   * Fetch the next instruction byte from memory at PC (for testing)
   */
  fetchInstruction(): number {
    const instruction = this.memory.read8(this.registers.PC);
    this.registers.PC = (this.registers.PC + 1) & 0xFFFF;
    return instruction;
  }

  /**
   * Fetch the next 8-bit immediate value from memory
   */
  private fetchImmediate8(): number {
    const value = this.memory.read8(this.registers.PC);
    this.registers.PC = (this.registers.PC + 1) & 0xFFFF;
    return value;
  }

  /**
   * Fetch the next 16-bit immediate value from memory (little-endian)
   */
  private fetchImmediate16(): number {
    const low = this.fetchImmediate8();
    const high = this.fetchImmediate8();
    return (high << 8) | low;
  }

  /**
   * Execute one instruction (fetch-decode-execute)
   */
  step(): void {
    // Handle pending interrupt enable (EI has delayed effect)
    if (this._pendingEnableInterrupt) {
      this._interruptMasterEnable = true;
      this._pendingEnableInterrupt = false;
    }

    // Check for interrupts (this can wake CPU from halt)
    if (this.checkInterrupts()) {
      return; // Interrupt was handled, cycles already consumed
    }

    if (this._isHalted) {
      // When halted, CPU still consumes cycles but doesn't execute instructions
      this._totalCycles += 4;
      return;
    }

    const opcode = this.memory.read8(this.registers.PC);
    this.registers.PC = (this.registers.PC + 1) & 0xFFFF;
    const cycles = this.instructionTable[opcode](opcode);
    this._totalCycles += cycles;
  }

  /**
   * Create the instruction lookup table
   */
  private createInstructionTable(): ((opcode: number) => number)[] {
    const table = new Array(256);

    // Initialize all opcodes to undefined instruction handler
    for (let i = 0; i < 256; i++) {
      table[i] = (opcode: number) => this.undefinedInstruction(opcode);
    }

    // 0x00: NOP
    table[0x00] = () => this.nop();

    // 8-bit load instructions - LD r,n
    table[0x06] = () => this.ld_B_n();  // LD B,n
    table[0x0E] = () => this.ld_C_n();  // LD C,n
    table[0x16] = () => this.ld_D_n();  // LD D,n
    table[0x1E] = () => this.ld_E_n();  // LD E,n
    table[0x26] = () => this.ld_H_n();  // LD H,n
    table[0x2E] = () => this.ld_L_n();  // LD L,n
    table[0x3E] = () => this.ld_A_n();  // LD A,n

    // Memory store instructions
    table[0xEA] = () => this.ld_nn_A(); // LD (nn),A

    // 16-bit load instructions
    table[0x01] = () => this.ld_BC_nn(); // LD BC,nn
    table[0x11] = () => this.ld_DE_nn(); // LD DE,nn
    table[0x21] = () => this.ld_HL_nn(); // LD HL,nn
    table[0x31] = () => this.ld_SP_nn(); // LD SP,nn

    // Jump instructions
    table[0xC3] = () => this.jp_nn();   // JP nn
    table[0x18] = () => this.jr_n();    // JR n
    table[0x28] = () => this.jr_Z_n();  // JR Z,n
    table[0x20] = () => this.jr_NZ_n(); // JR NZ,n
    table[0x30] = () => this.jr_NC_n(); // JR NC,n
    table[0x38] = () => this.jr_C_n();  // JR C,n

    // Arithmetic instructions
    table[0x3C] = () => this.inc_A();   // INC A
    table[0x04] = () => this.inc_B();   // INC B
    table[0x0C] = () => this.inc_C();   // INC C
    table[0x14] = () => this.inc_D();   // INC D
    table[0x1C] = () => this.inc_E();   // INC E
    table[0x24] = () => this.inc_H();   // INC H
    table[0x2C] = () => this.inc_L();   // INC L
    
    table[0x3D] = () => this.dec_A();   // DEC A
    table[0x05] = () => this.dec_B();   // DEC B
    table[0x0D] = () => this.dec_C();   // DEC C
    table[0x15] = () => this.dec_D();   // DEC D
    table[0x1D] = () => this.dec_E();   // DEC E
    table[0x25] = () => this.dec_H();   // DEC H
    table[0x2D] = () => this.dec_L();   // DEC L

    table[0xC6] = () => this.add_A_n(); // ADD A,n
    table[0xFE] = () => this.cp_n();    // CP n

    // Stack instructions
    table[0xC5] = () => this.push_BC(); // PUSH BC
    table[0xD5] = () => this.push_DE(); // PUSH DE
    table[0xE5] = () => this.push_HL(); // PUSH HL
    table[0xF5] = () => this.push_AF(); // PUSH AF

    table[0xC1] = () => this.pop_BC();  // POP BC
    table[0xD1] = () => this.pop_DE();  // POP DE
    table[0xE1] = () => this.pop_HL();  // POP HL
    table[0xF1] = () => this.pop_AF();  // POP AF

    table[0xCD] = () => this.call_nn(); // CALL nn
    table[0xC9] = () => this.ret();     // RET

    // CB prefix for extended instructions
    table[0xCB] = () => this.executeCBInstruction(); // CB prefix

    // Register to register LD instructions (0x40-0x7F)
    // LD B,r
    table[0x40] = () => this.ld_B_B();   // LD B,B
    table[0x41] = () => this.ld_B_C();   // LD B,C
    table[0x42] = () => this.ld_B_D();   // LD B,D
    table[0x43] = () => this.ld_B_E();   // LD B,E
    table[0x44] = () => this.ld_B_H();   // LD B,H
    table[0x45] = () => this.ld_B_L();   // LD B,L
    table[0x46] = () => this.ld_B_HL();  // LD B,(HL)
    table[0x47] = () => this.ld_B_A();   // LD B,A

    // LD C,r
    table[0x48] = () => this.ld_C_B();   // LD C,B
    table[0x49] = () => this.ld_C_C();   // LD C,C
    table[0x4A] = () => this.ld_C_D();   // LD C,D
    table[0x4B] = () => this.ld_C_E();   // LD C,E
    table[0x4C] = () => this.ld_C_H();   // LD C,H
    table[0x4D] = () => this.ld_C_L();   // LD C,L
    table[0x4E] = () => this.ld_C_HL();  // LD C,(HL)
    table[0x4F] = () => this.ld_C_A();   // LD C,A

    // LD D,r
    table[0x50] = () => this.ld_D_B();   // LD D,B
    table[0x51] = () => this.ld_D_C();   // LD D,C
    table[0x52] = () => this.ld_D_D();   // LD D,D
    table[0x53] = () => this.ld_D_E();   // LD D,E
    table[0x54] = () => this.ld_D_H();   // LD D,H
    table[0x55] = () => this.ld_D_L();   // LD D,L
    table[0x56] = () => this.ld_D_HL();  // LD D,(HL)
    table[0x57] = () => this.ld_D_A();   // LD D,A

    // LD E,r
    table[0x58] = () => this.ld_E_B();   // LD E,B
    table[0x59] = () => this.ld_E_C();   // LD E,C
    table[0x5A] = () => this.ld_E_D();   // LD E,D
    table[0x5B] = () => this.ld_E_E();   // LD E,E
    table[0x5C] = () => this.ld_E_H();   // LD E,H
    table[0x5D] = () => this.ld_E_L();   // LD E,L
    table[0x5E] = () => this.ld_E_HL();  // LD E,(HL)
    table[0x5F] = () => this.ld_E_A();   // LD E,A

    // LD H,r
    table[0x60] = () => this.ld_H_B();   // LD H,B
    table[0x61] = () => this.ld_H_C();   // LD H,C
    table[0x62] = () => this.ld_H_D();   // LD H,D
    table[0x63] = () => this.ld_H_E();   // LD H,E
    table[0x64] = () => this.ld_H_H();   // LD H,H
    table[0x65] = () => this.ld_H_L();   // LD H,L
    table[0x66] = () => this.ld_H_HL();  // LD H,(HL)
    table[0x67] = () => this.ld_H_A();   // LD H,A

    // LD L,r
    table[0x68] = () => this.ld_L_B();   // LD L,B
    table[0x69] = () => this.ld_L_C();   // LD L,C
    table[0x6A] = () => this.ld_L_D();   // LD L,D
    table[0x6B] = () => this.ld_L_E();   // LD L,E
    table[0x6C] = () => this.ld_L_H();   // LD L,H
    table[0x6D] = () => this.ld_L_L();   // LD L,L
    table[0x6E] = () => this.ld_L_HL();  // LD L,(HL)
    table[0x6F] = () => this.ld_L_A();   // LD L,A

    // LD (HL),r
    table[0x70] = () => this.ld_HL_B();  // LD (HL),B
    table[0x71] = () => this.ld_HL_C();  // LD (HL),C
    table[0x72] = () => this.ld_HL_D();  // LD (HL),D
    table[0x73] = () => this.ld_HL_E();  // LD (HL),E
    table[0x74] = () => this.ld_HL_H();  // LD (HL),H
    table[0x75] = () => this.ld_HL_L();  // LD (HL),L
    table[0x76] = () => this.halt();     // HALT
    table[0x77] = () => this.ld_HL_A();  // LD (HL),A

    // LD A,r
    table[0x78] = () => this.ld_A_B();   // LD A,B
    table[0x79] = () => this.ld_A_C();   // LD A,C
    table[0x7A] = () => this.ld_A_D();   // LD A,D
    table[0x7B] = () => this.ld_A_E();   // LD A,E
    table[0x7C] = () => this.ld_A_H();   // LD A,H
    table[0x7D] = () => this.ld_A_L();   // LD A,L
    table[0x7E] = () => this.ld_A_HL();  // LD A,(HL)
    table[0x7F] = () => this.ld_A_A();   // LD A,A

    // More arithmetic operations
    table[0x80] = () => this.add_A_B();  // ADD A,B
    table[0x81] = () => this.add_A_C();  // ADD A,C
    table[0x82] = () => this.add_A_D();  // ADD A,D
    table[0x83] = () => this.add_A_E();  // ADD A,E
    table[0x84] = () => this.add_A_H();  // ADD A,H
    table[0x85] = () => this.add_A_L();  // ADD A,L
    table[0x86] = () => this.add_A_HL(); // ADD A,(HL)
    table[0x87] = () => this.add_A_A();  // ADD A,A

    // SUB operations
    table[0x90] = () => this.sub_B();    // SUB B
    table[0x91] = () => this.sub_C();    // SUB C
    table[0x92] = () => this.sub_D();    // SUB D
    table[0x93] = () => this.sub_E();    // SUB E
    table[0x94] = () => this.sub_H();    // SUB H
    table[0x95] = () => this.sub_L();    // SUB L
    table[0x96] = () => this.sub_HL();   // SUB (HL)
    table[0x97] = () => this.sub_A();    // SUB A

    // AND operations
    table[0xA0] = () => this.and_B();    // AND B
    table[0xA1] = () => this.and_C();    // AND C
    table[0xA2] = () => this.and_D();    // AND D
    table[0xA3] = () => this.and_E();    // AND E
    table[0xA4] = () => this.and_H();    // AND H
    table[0xA5] = () => this.and_L();    // AND L
    table[0xA6] = () => this.and_HL();   // AND (HL)
    table[0xA7] = () => this.and_A();    // AND A

    // OR operations
    table[0xB0] = () => this.or_B();     // OR B
    table[0xB1] = () => this.or_C();     // OR C
    table[0xB2] = () => this.or_D();     // OR D
    table[0xB3] = () => this.or_E();     // OR E
    table[0xB4] = () => this.or_H();     // OR H
    table[0xB5] = () => this.or_L();     // OR L
    table[0xB6] = () => this.or_HL();    // OR (HL)
    table[0xB7] = () => this.or_A();     // OR A

    // CP operations
    table[0xB8] = () => this.cp_B();     // CP B
    table[0xB9] = () => this.cp_C();     // CP C
    table[0xBA] = () => this.cp_D();     // CP D
    table[0xBB] = () => this.cp_E();     // CP E
    table[0xBC] = () => this.cp_H();     // CP H
    table[0xBD] = () => this.cp_L();     // CP L
    table[0xBE] = () => this.cp_HL();    // CP (HL)
    // table[0xBF] = () => this.cp_A();  // Already implemented

    // Additional load instructions
    table[0x02] = () => this.ld_BC_A();  // LD (BC),A
    table[0x0A] = () => this.ld_A_BC();  // LD A,(BC)
    table[0x12] = () => this.ld_DE_A();  // LD (DE),A
    table[0x1A] = () => this.ld_A_DE();  // LD A,(DE)
    table[0x22] = () => this.ld_HLI_A(); // LD (HL+),A
    table[0x2A] = () => this.ld_A_HLI(); // LD A,(HL+)
    table[0x32] = () => this.ld_HLD_A(); // LD (HL-),A
    table[0x3A] = () => this.ld_A_HLD(); // LD A,(HL-)
    table[0x36] = () => this.ld_HL_n();  // LD (HL),n
    table[0xE0] = () => this.ldh_n_A();  // LDH (n),A
    table[0xE2] = () => this.ld_FF00_C_A(); // LD (0xFF00+C),A
    table[0xF0] = () => this.ldh_A_n();  // LDH A,(n)
    table[0xF2] = () => this.ld_A_FF00_C(); // LD A,(0xFF00+C)
    table[0xFA] = () => this.ld_A_nn();  // LD A,(nn)

    // 16-bit arithmetic
    table[0x03] = () => this.inc_BC();   // INC BC
    table[0x13] = () => this.inc_DE();   // INC DE
    table[0x23] = () => this.inc_HL();   // INC HL
    table[0x33] = () => this.inc_SP();   // INC SP
    table[0x0B] = () => this.dec_BC();   // DEC BC
    table[0x1B] = () => this.dec_DE();   // DEC DE
    table[0x2B] = () => this.dec_HL();   // DEC HL
    table[0x3B] = () => this.dec_SP();   // DEC SP

    // 16-bit ADD HL operations
    table[0x09] = () => this.add_HL_BC(); // ADD HL,BC
    table[0x19] = () => this.add_HL_DE(); // ADD HL,DE
    table[0x29] = () => this.add_HL_HL(); // ADD HL,HL
    table[0x39] = () => this.add_HL_SP(); // ADD HL,SP

    // Memory operations with immediate
    table[0x34] = () => this.inc_HL_addr(); // INC (HL)
    table[0x35] = () => this.dec_HL_addr(); // DEC (HL)

    // Rotate and shift operations
    table[0x07] = () => this.rlca();     // RLCA
    table[0x0F] = () => this.rrca();     // RRCA
    table[0x17] = () => this.rla();      // RLA
    table[0x1F] = () => this.rra();      // RRA

    // Complement operations
    table[0x2F] = () => this.cpl();      // CPL
    table[0x37] = () => this.scf();      // SCF
    table[0x3F] = () => this.ccf();      // CCF

    // DAA
    table[0x27] = () => this.daa();      // DAA

    // Interrupt control
    table[0xF3] = () => this.di();       // DI
    table[0xFB] = () => this.ei();       // EI

    // Additional arithmetic with immediate
    table[0xE6] = () => this.and_n();    // AND n
    table[0xEE] = () => this.xor_n();    // XOR n
    table[0xF6] = () => this.or_n();     // OR n
    table[0xD6] = () => this.sub_n();    // SUB n

    // Stack operations with 16-bit registers
    table[0xF8] = () => this.ld_HL_SP_n(); // LD HL,SP+n
    table[0xF9] = () => this.ld_SP_HL();   // LD SP,HL
    table[0xE8] = () => this.add_SP_n();   // ADD SP,n

    // Jump operations
    table[0xE9] = () => this.jp_HL();      // JP (HL)

    // Conditional returns and calls
    table[0xC0] = () => this.ret_NZ();     // RET NZ
    table[0xC8] = () => this.ret_Z();      // RET Z
    table[0xD0] = () => this.ret_NC();     // RET NC
    table[0xD8] = () => this.ret_C();      // RET C
    table[0xD9] = () => this.reti();       // RETI (Return from Interrupt)

    table[0xC2] = () => this.jp_NZ_nn();   // JP NZ,nn
    table[0xCA] = () => this.jp_Z_nn();    // JP Z,nn
    table[0xD2] = () => this.jp_NC_nn();   // JP NC,nn
    table[0xDA] = () => this.jp_C_nn();    // JP C,nn

    table[0xC4] = () => this.call_NZ_nn(); // CALL NZ,nn
    table[0xCC] = () => this.call_Z_nn();  // CALL Z,nn
    table[0xD4] = () => this.call_NC_nn(); // CALL NC,nn
    table[0xDC] = () => this.call_C_nn();  // CALL C,nn

    // XOR operations
    table[0xA8] = () => this.xor_B();      // XOR B
    table[0xA9] = () => this.xor_C();      // XOR C
    table[0xAA] = () => this.xor_D();      // XOR D
    table[0xAB] = () => this.xor_E();      // XOR E
    table[0xAC] = () => this.xor_H();      // XOR H
    table[0xAD] = () => this.xor_L();      // XOR L
    table[0xAE] = () => this.xor_HL();     // XOR (HL)
    table[0xAF] = () => this.xor_A();      // XOR A

    // ADC (add with carry) operations
    table[0x88] = () => this.adc_B();      // ADC A,B
    table[0x89] = () => this.adc_C();      // ADC A,C
    table[0x8A] = () => this.adc_D();      // ADC A,D
    table[0x8B] = () => this.adc_E();      // ADC A,E
    table[0x8C] = () => this.adc_H();      // ADC A,H
    table[0x8D] = () => this.adc_L();      // ADC A,L
    table[0x8E] = () => this.adc_HL();     // ADC A,(HL)
    table[0x8F] = () => this.adc_A();      // ADC A,A

    // SBC (subtract with carry) operations
    table[0x98] = () => this.sbc_B();      // SBC A,B
    table[0x99] = () => this.sbc_C();      // SBC A,C
    table[0x9A] = () => this.sbc_D();      // SBC A,D
    table[0x9B] = () => this.sbc_E();      // SBC A,E
    table[0x9C] = () => this.sbc_H();      // SBC A,H
    table[0x9D] = () => this.sbc_L();      // SBC A,L
    table[0x9E] = () => this.sbc_HL();     // SBC A,(HL)
    table[0x9F] = () => this.sbc_A();      // SBC A,A

    // More immediate arithmetic
    table[0xCE] = () => this.adc_n();      // ADC A,n
    table[0xDE] = () => this.sbc_n();      // SBC A,n

    // RST instructions
    table[0xC7] = () => this.rst_00();     // RST 00H
    table[0xCF] = () => this.rst_08();     // RST 08H
    table[0xD7] = () => this.rst_10();     // RST 10H
    table[0xDF] = () => this.rst_18();     // RST 18H
    table[0xE7] = () => this.rst_20();     // RST 20H
    table[0xEF] = () => this.rst_28();     // RST 28H
    table[0xF7] = () => this.rst_30();     // RST 30H
    table[0xFF] = () => this.rst_38();     // RST 38H

    // Control instructions
    table[0x08] = () => this.ld_nn_SP();   // LD (nn),SP
    table[0x10] = () => this.stop();       // STOP
    table[0xF3] = () => this.di();         // DI (Disable Interrupts)
    table[0xFB] = () => this.ei();         // EI (Enable Interrupts)

    return table;
  }

  // Instruction implementations

  private nop(): number {
    // No operation - just consume cycles
    return 4;
  }

  private undefinedInstruction(opcode: number): number {
    throw new Error('Undefined instruction: 0x' + opcode.toString(16).padStart(2, '0'));
  }

  // 8-bit load immediate instructions
  private ld_B_n(): number {
    // this.registers.B = this.fetchImmediate8();
    // O(1) array access:
    (this.registers as any).regs[REG_B] = this.fetchImmediate8();
    return 8;
  }

  private ld_C_n(): number {
    (this.registers as any).regs[REG_C] = this.fetchImmediate8();
    return 8;
  }

  private ld_D_n(): number {
    (this.registers as any).regs[REG_D] = this.fetchImmediate8();
    return 8;
  }

  private ld_E_n(): number {
    (this.registers as any).regs[REG_E] = this.fetchImmediate8();
    return 8;
  }

  private ld_H_n(): number {
    (this.registers as any).regs[REG_H] = this.fetchImmediate8();
    return 8;
  }

  private ld_L_n(): number {
    (this.registers as any).regs[REG_L] = this.fetchImmediate8();
    return 8;
  }

  private ld_A_n(): number {
    (this.registers as any).regs[REG_A] = this.fetchImmediate8();
    return 8;
  }

  // 8-bit register-to-register load instructions
  private ld_B_B(): number {
    (this.registers as any).regs[REG_B] = (this.registers as any).regs[REG_B];
    return 4;
  }

  private ld_B_C(): number {
    (this.registers as any).regs[REG_B] = (this.registers as any).regs[REG_C];
    return 4;
  }

  private ld_B_D(): number {
    (this.registers as any).regs[REG_B] = (this.registers as any).regs[REG_D];
    return 4;
  }

  private ld_B_E(): number {
    (this.registers as any).regs[REG_B] = (this.registers as any).regs[REG_E];
    return 4;
  }

  private ld_B_H(): number {
    (this.registers as any).regs[REG_B] = (this.registers as any).regs[REG_H];
    return 4;
  }

  private ld_B_L(): number {
    (this.registers as any).regs[REG_B] = (this.registers as any).regs[REG_L];
    return 4;
  }

  private ld_B_HL(): number {
    (this.registers as any).regs[REG_B] = this.memory.read8(this.registers.HL);
    return 8;
  }

  private ld_B_A(): number {
    (this.registers as any).regs[REG_B] = (this.registers as any).regs[REG_A];
    return 4;
  }

  private ld_C_B(): number {
    (this.registers as any).regs[REG_C] = (this.registers as any).regs[REG_B];
    return 4;
  }

  private ld_C_C(): number {
    (this.registers as any).regs[REG_C] = (this.registers as any).regs[REG_C];
    return 4;
  }

  private ld_C_D(): number {
    (this.registers as any).regs[REG_C] = (this.registers as any).regs[REG_D];
    return 4;
  }

  private ld_C_E(): number {
    (this.registers as any).regs[REG_C] = (this.registers as any).regs[REG_E];
    return 4;
  }

  private ld_C_H(): number {
    (this.registers as any).regs[REG_C] = (this.registers as any).regs[REG_H];
    return 4;
  }

  private ld_C_L(): number {
    (this.registers as any).regs[REG_C] = (this.registers as any).regs[REG_L];
    return 4;
  }

  private ld_C_HL(): number {
    (this.registers as any).regs[REG_C] = this.memory.read8(this.registers.HL);
    return 8;
  }

  private ld_C_A(): number {
    (this.registers as any).regs[REG_C] = (this.registers as any).regs[REG_A];
    return 4;
  }

  private ld_D_B(): number {
    (this.registers as any).regs[REG_D] = (this.registers as any).regs[REG_B];
    return 4;
  }

  private ld_D_C(): number {
    (this.registers as any).regs[REG_D] = (this.registers as any).regs[REG_C];
    return 4;
  }

  private ld_D_D(): number {
    (this.registers as any).regs[REG_D] = (this.registers as any).regs[REG_D];
    return 4;
  }

  private ld_D_E(): number {
    (this.registers as any).regs[REG_D] = (this.registers as any).regs[REG_E];
    return 4;
  }

  private ld_D_H(): number {
    (this.registers as any).regs[REG_D] = (this.registers as any).regs[REG_H];
    return 4;
  }

  private ld_D_L(): number {
    (this.registers as any).regs[REG_D] = (this.registers as any).regs[REG_L];
    return 4;
  }

  private ld_D_HL(): number {
    (this.registers as any).regs[REG_D] = this.memory.read8(this.registers.HL);
    return 8;
  }

  private ld_D_A(): number {
    (this.registers as any).regs[REG_D] = (this.registers as any).regs[REG_A];
    return 4;
  }

  private ld_E_B(): number {
    (this.registers as any).regs[REG_E] = (this.registers as any).regs[REG_B];
    return 4;
  }

  private ld_E_C(): number {
    (this.registers as any).regs[REG_E] = (this.registers as any).regs[REG_C];
    return 4;
  }

  private ld_E_D(): number {
    (this.registers as any).regs[REG_E] = (this.registers as any).regs[REG_D];
    return 4;
  }

  private ld_E_E(): number {
    (this.registers as any).regs[REG_E] = (this.registers as any).regs[REG_E];
    return 4;
  }

  private ld_E_H(): number {
    (this.registers as any).regs[REG_E] = (this.registers as any).regs[REG_H];
    return 4;
  }

  private ld_E_L(): number {
    (this.registers as any).regs[REG_E] = (this.registers as any).regs[REG_L];
    return 4;
  }

  private ld_E_HL(): number {
    (this.registers as any).regs[REG_E] = this.memory.read8(this.registers.HL);
    return 8;
  }

  private ld_E_A(): number {
    (this.registers as any).regs[REG_E] = (this.registers as any).regs[REG_A];
    return 4;
  }

  private ld_H_B(): number {
    (this.registers as any).regs[REG_H] = (this.registers as any).regs[REG_B];
    return 4;
  }

  private ld_H_C(): number {
    (this.registers as any).regs[REG_H] = (this.registers as any).regs[REG_C];
    return 4;
  }

  private ld_H_D(): number {
    (this.registers as any).regs[REG_H] = (this.registers as any).regs[REG_D];
    return 4;
  }

  private ld_H_E(): number {
    (this.registers as any).regs[REG_H] = (this.registers as any).regs[REG_E];
    return 4;
  }

  private ld_H_H(): number {
    (this.registers as any).regs[REG_H] = (this.registers as any).regs[REG_H];
    return 4;
  }

  private ld_H_L(): number {
    (this.registers as any).regs[REG_H] = (this.registers as any).regs[REG_L];
    return 4;
  }

  private ld_H_HL(): number {
    (this.registers as any).regs[REG_H] = this.memory.read8(this.registers.HL);
    return 8;
  }

  private ld_H_A(): number {
    (this.registers as any).regs[REG_H] = (this.registers as any).regs[REG_A];
    return 4;
  }

  private ld_L_B(): number {
    (this.registers as any).regs[REG_L] = (this.registers as any).regs[REG_B];
    return 4;
  }

  private ld_L_C(): number {
    (this.registers as any).regs[REG_L] = (this.registers as any).regs[REG_C];
    return 4;
  }

  private ld_L_D(): number {
    (this.registers as any).regs[REG_L] = (this.registers as any).regs[REG_D];
    return 4;
  }

  private ld_L_E(): number {
    (this.registers as any).regs[REG_L] = (this.registers as any).regs[REG_E];
    return 4;
  }

  private ld_L_H(): number {
    (this.registers as any).regs[REG_L] = (this.registers as any).regs[REG_H];
    return 4;
  }

  private ld_L_L(): number {
    (this.registers as any).regs[REG_L] = (this.registers as any).regs[REG_L];
    return 4;
  }

  private ld_L_HL(): number {
    (this.registers as any).regs[REG_L] = this.memory.read8(this.registers.HL);
    return 8;
  }

  private ld_L_A(): number {
    (this.registers as any).regs[REG_L] = (this.registers as any).regs[REG_A];
    return 4;
  }

  private ld_A_B(): number {
    (this.registers as any).regs[REG_A] = (this.registers as any).regs[REG_B];
    return 4;
  }

  private ld_A_C(): number {
    (this.registers as any).regs[REG_A] = (this.registers as any).regs[REG_C];
    return 4;
  }

  private ld_A_D(): number {
    (this.registers as any).regs[REG_A] = (this.registers as any).regs[REG_D];
    return 4;
  }

  private ld_A_E(): number {
    (this.registers as any).regs[REG_A] = (this.registers as any).regs[REG_E];
    return 4;
  }

  private ld_A_H(): number {
    (this.registers as any).regs[REG_A] = (this.registers as any).regs[REG_H];
    return 4;
  }

  private ld_A_L(): number {
    (this.registers as any).regs[REG_A] = (this.registers as any).regs[REG_L];
    return 4;
  }

  private ld_A_A(): number {
    (this.registers as any).regs[REG_A] = (this.registers as any).regs[REG_A]; // Essentially a NOP but still valid
    return 4;
  }

  // Memory load instructions
  private ld_A_HL(): number {
    this.registers.A = this.memory.read8(this.registers.HL);
    return 8;
  }

  private ld_HL_A(): number {
    this.memory.write8(this.registers.HL, this.registers.A);
    return 8;
  }

  private ld_nn_A(): number {
    const address = this.fetchImmediate16();
    this.memory.write8(address, this.registers.A);
    return 16;
  }

  // 16-bit load immediate instructions
  private ld_BC_nn(): number {
    this.registers.BC = this.fetchImmediate16();
    return 12;
  }

  private ld_DE_nn(): number {
    this.registers.DE = this.fetchImmediate16();
    return 12;
  }

  private ld_HL_nn(): number {
    this.registers.HL = this.fetchImmediate16();
    return 12;
  }

  private ld_SP_nn(): number {
    this.registers.SP = this.fetchImmediate16();
    return 12;
  }

  // Jump instructions
  private jp_nn(): number {
    this.registers.PC = this.fetchImmediate16();
    return 16;
  }

  private jr_n(): number {
    const offset = this.fetchImmediate8();
    // Convert to signed 8-bit offset
    const signedOffset = offset > 127 ? offset - 256 : offset;
    this.registers.PC = (this.registers.PC + signedOffset) & 0xFFFF;
    return 12;
  }

  private jr_Z_n(): number {
    const offset = this.fetchImmediate8();
    if (this.registers.flagZ) {
      const signedOffset = offset > 127 ? offset - 256 : offset;
      this.registers.PC = (this.registers.PC + signedOffset) & 0xFFFF;
      return 12; // Branch taken
    }
    return 8; // Branch not taken
  }

  private jr_NZ_n(): number {
    const offset = this.fetchImmediate8();
    if (!this.registers.flagZ) {
      const signedOffset = offset > 127 ? offset - 256 : offset;
      this.registers.PC = (this.registers.PC + signedOffset) & 0xFFFF;
      return 12; // Branch taken
    }
    return 8; // Branch not taken
  }

  private jr_NC_n(): number {
    const offset = this.fetchImmediate8();
    if (!this.registers.flagC) {
      const signedOffset = offset > 127 ? offset - 256 : offset;
      this.registers.PC = (this.registers.PC + signedOffset) & 0xFFFF;
      return 12; // Branch taken
    }
    return 8; // Branch not taken
  }

  private jr_C_n(): number {
    const offset = this.fetchImmediate8();
    if (this.registers.flagC) {
      const signedOffset = offset > 127 ? offset - 256 : offset;
      this.registers.PC = (this.registers.PC + signedOffset) & 0xFFFF;
      return 12; // Branch taken
    }
    return 8; // Branch not taken
  }

  // 8-bit arithmetic instructions
  private inc_A(): number { return this.inc8bit('A'); }
  private inc_B(): number { return this.inc8bit('B'); }
  private inc_C(): number { return this.inc8bit('C'); }
  private inc_D(): number { return this.inc8bit('D'); }
  private inc_E(): number { return this.inc8bit('E'); }
  private inc_H(): number { return this.inc8bit('H'); }
  private inc_L(): number { return this.inc8bit('L'); }

  private dec_A(): number { return this.dec8bit('A'); }
  private dec_B(): number { return this.dec8bit('B'); }
  private dec_C(): number { return this.dec8bit('C'); }
  private dec_D(): number { return this.dec8bit('D'); }
  private dec_E(): number { return this.dec8bit('E'); }
  private dec_H(): number { return this.dec8bit('H'); }
  private dec_L(): number { return this.dec8bit('L'); }

  // Helper for 8-bit increment
  private inc8bit(register: 'A' | 'B' | 'C' | 'D' | 'E' | 'H' | 'L'): number {
    const value = this.registers[register];
    const result = (value + 1) & 0xFF;
    this.registers[register] = result;
    
    // Set flags
    this.registers.flagZ = result === 0;
    this.registers.flagN = false;
    this.registers.flagH = (value & 0x0F) === 0x0F; // Half-carry from bit 3
    // Carry flag unaffected
    
    return 4;
  }

  // Helper for 8-bit decrement
  private dec8bit(register: 'A' | 'B' | 'C' | 'D' | 'E' | 'H' | 'L'): number {
    const value = this.registers[register];
    const result = (value - 1) & 0xFF;
    this.registers[register] = result;
    
    // Set flags
    this.registers.flagZ = result === 0;
    this.registers.flagN = true;
    this.registers.flagH = (value & 0x0F) === 0; // Half-borrow from bit 4
    // Carry flag unaffected
    
    return 4;
  }

  private add_A_n(): number {
    const value = this.fetchImmediate8();
    const result = this.registers.A + value;
    
    // Set flags
    this.registers.flagZ = (result & 0xFF) === 0;
    this.registers.flagN = false;
    this.registers.flagH = (this.registers.A & 0x0F) + (value & 0x0F) > 0x0F;
    this.registers.flagC = result > 0xFF;
    
    this.registers.A = result & 0xFF;
    return 8;
  }

  private cp_n(): number {
    const value = this.fetchImmediate8();
    const result = this.registers.A - value;
    
    // Set flags (compare is subtraction but doesn't store result)
    this.registers.flagZ = (result & 0xFF) === 0;
    this.registers.flagN = true;
    this.registers.flagH = (this.registers.A & 0x0F) < (value & 0x0F);
    this.registers.flagC = result < 0;
    
    return 8;
  }

  // Stack operations
  private push_BC(): number {
    this.pushStack(this.registers.BC);
    return 16;
  }

  private push_DE(): number {
    this.pushStack(this.registers.DE);
    return 16;
  }

  private push_HL(): number {
    this.pushStack(this.registers.HL);
    return 16;
  }

  private push_AF(): number {
    this.pushStack(this.registers.AF);
    return 16;
  }

  private pop_BC(): number {
    this.registers.BC = this.popStack();
    return 12;
  }

  private pop_DE(): number {
    this.registers.DE = this.popStack();
    return 12;
  }

  private pop_HL(): number {
    this.registers.HL = this.popStack();
    return 12;
  }

  private pop_AF(): number {
    this.registers.AF = this.popStack();
    return 12;
  }

  // Stack helper methods
  private pushStack(value: number): void {
    this.registers.SP = (this.registers.SP - 2) & 0xFFFF;
    this.memory.write16(this.registers.SP, value);
  }

  private popStack(): number {
    const value = this.memory.read16(this.registers.SP);
    this.registers.SP = (this.registers.SP + 2) & 0xFFFF;
    return value;
  }

  // Call and return instructions
  private call_nn(): number {
    const address = this.fetchImmediate16();
    this.pushStack(this.registers.PC); // Push return address
    this.registers.PC = address;
    return 24;
  }

  private ret(): number {
    this.registers.PC = this.popStack();
    return 16;
  }

  private reti(): number {
    // RETI - Return from Interrupt
    this.registers.PC = this.popStack();
    this._interruptMasterEnable = true;
    this._pendingEnableInterrupt = false; // Cancel any pending EI
    return 16;
  }

  // Control instructions
  private halt(): number {
    this._isHalted = true;
    return 4;
  }

  // Additional memory load instructions
  private ld_BC_A(): number { this.memory.write8(this.registers.BC, this.registers.A); return 8; }
  private ld_A_BC(): number { this.registers.A = this.memory.read8(this.registers.BC); return 8; }
  private ld_DE_A(): number { this.memory.write8(this.registers.DE, this.registers.A); return 8; }
  private ld_A_DE(): number { this.registers.A = this.memory.read8(this.registers.DE); return 8; }
  
  private ld_HLI_A(): number { 
    this.memory.write8(this.registers.HL, this.registers.A); 
    this.registers.HL = (this.registers.HL + 1) & 0xFFFF;
    return 8; 
  }
  
  private ld_A_HLI(): number { 
    this.registers.A = this.memory.read8(this.registers.HL); 
    this.registers.HL = (this.registers.HL + 1) & 0xFFFF;
    return 8; 
  }
  
  private ld_HLD_A(): number { 
    this.memory.write8(this.registers.HL, this.registers.A); 
    this.registers.HL = (this.registers.HL - 1) & 0xFFFF;
    return 8; 
  }
  
  private ld_A_HLD(): number { 
    this.registers.A = this.memory.read8(this.registers.HL); 
    this.registers.HL = (this.registers.HL - 1) & 0xFFFF;
    return 8; 
  }

  private ld_HL_n(): number { 
    const value = this.fetchImmediate8();
    this.memory.write8(this.registers.HL, value); 
    return 12; 
  }

  private ld_A_nn(): number {
    const address = this.fetchImmediate16();
    this.registers.A = this.memory.read8(address);
    return 16;
  }

  // High memory operations
  private ldh_n_A(): number { 
    const offset = this.fetchImmediate8();
    this.memory.write8(0xFF00 + offset, this.registers.A); 
    return 12; 
  }

  private ldh_A_n(): number { 
    const offset = this.fetchImmediate8();
    this.registers.A = this.memory.read8(0xFF00 + offset); 
    return 12; 
  }

  // Note: ld_C_A and ld_A_C are overloaded - they can mean register ops or high memory ops
  // For high memory ops, treating (C) as (0xFF00+C)
  // Register ops are already implemented above

  // Arithmetic operations
  private add_A_C(): number { return this.addToA(this.registers.C); }
  private add_A_D(): number { return this.addToA(this.registers.D); }
  private add_A_E(): number { return this.addToA(this.registers.E); }
  private add_A_H(): number { return this.addToA(this.registers.H); }
  private add_A_L(): number { return this.addToA(this.registers.L); }
  private add_A_HL(): number { return this.addToA(this.memory.read8(this.registers.HL), 8); }
  private add_A_A(): number { return this.addToA(this.registers.A); }

  private add_A_B(): number { return this.addToA(this.registers.B); }

  private addToA(value: number, cycles = 4): number {
    const result = this.registers.A + value;
    this.registers.flagZ = (result & 0xFF) === 0;
    this.registers.flagN = false;
    this.registers.flagH = (this.registers.A & 0x0F) + (value & 0x0F) > 0x0F;
    this.registers.flagC = result > 0xFF;
    this.registers.A = result & 0xFF;
    return cycles;
  }

  // SUB operations
  private sub_B(): number { return this.subFromA(this.registers.B); }
  private sub_C(): number { return this.subFromA(this.registers.C); }
  private sub_D(): number { return this.subFromA(this.registers.D); }
  private sub_E(): number { return this.subFromA(this.registers.E); }
  private sub_H(): number { return this.subFromA(this.registers.H); }
  private sub_L(): number { return this.subFromA(this.registers.L); }
  private sub_HL(): number { return this.subFromA(this.memory.read8(this.registers.HL), 8); }
  private sub_A(): number { return this.subFromA(this.registers.A); }

  private subFromA(value: number, cycles = 4): number {
    const result = this.registers.A - value;
    this.registers.flagZ = (result & 0xFF) === 0;
    this.registers.flagN = true;
    this.registers.flagH = (this.registers.A & 0x0F) < (value & 0x0F);
    this.registers.flagC = result < 0;
    this.registers.A = result & 0xFF;
    return cycles;
  }

  // AND operations
  private and_B(): number { return this.andWithA(this.registers.B); }
  private and_C(): number { return this.andWithA(this.registers.C); }
  private and_D(): number { return this.andWithA(this.registers.D); }
  private and_E(): number { return this.andWithA(this.registers.E); }
  private and_H(): number { return this.andWithA(this.registers.H); }
  private and_L(): number { return this.andWithA(this.registers.L); }
  private and_HL(): number { return this.andWithA(this.memory.read8(this.registers.HL), 8); }
  private and_A(): number { return this.andWithA(this.registers.A); }

  private andWithA(value: number, cycles = 4): number {
    this.registers.A &= value;
    this.registers.flagZ = this.registers.A === 0;
    this.registers.flagN = false;
    this.registers.flagH = true;
    this.registers.flagC = false;
    return cycles;
  }

  // OR operations
  private or_B(): number { return this.orWithA(this.registers.B); }
  private or_C(): number { return this.orWithA(this.registers.C); }
  private or_D(): number { return this.orWithA(this.registers.D); }
  private or_E(): number { return this.orWithA(this.registers.E); }
  private or_H(): number { return this.orWithA(this.registers.H); }
  private or_L(): number { return this.orWithA(this.registers.L); }
  private or_HL(): number { return this.orWithA(this.memory.read8(this.registers.HL), 8); }
  private or_A(): number { return this.orWithA(this.registers.A); }

  private orWithA(value: number, cycles = 4): number {
    this.registers.A |= value;
    this.registers.flagZ = this.registers.A === 0;
    this.registers.flagN = false;
    this.registers.flagH = false;
    this.registers.flagC = false;
    return cycles;
  }

  // XOR operations
  private xor_B(): number { return this.xorWithA(this.registers.B); }
  private xor_C(): number { return this.xorWithA(this.registers.C); }
  private xor_D(): number { return this.xorWithA(this.registers.D); }
  private xor_E(): number { return this.xorWithA(this.registers.E); }
  private xor_H(): number { return this.xorWithA(this.registers.H); }
  private xor_L(): number { return this.xorWithA(this.registers.L); }
  private xor_HL(): number { return this.xorWithA(this.memory.read8(this.registers.HL), 8); }
  private xor_A(): number { return this.xorWithA(this.registers.A); }

  private xorWithA(value: number, cycles = 4): number {
    this.registers.A ^= value;
    this.registers.flagZ = this.registers.A === 0;
    this.registers.flagN = false;
    this.registers.flagH = false;
    this.registers.flagC = false;
    return cycles;
  }

  // CP operations
  private cp_B(): number { return this.compareWithA(this.registers.B); }
  private cp_C(): number { return this.compareWithA(this.registers.C); }
  private cp_D(): number { return this.compareWithA(this.registers.D); }
  private cp_E(): number { return this.compareWithA(this.registers.E); }
  private cp_H(): number { return this.compareWithA(this.registers.H); }
  private cp_L(): number { return this.compareWithA(this.registers.L); }
  private cp_HL(): number { return this.compareWithA(this.memory.read8(this.registers.HL), 8); }

  private compareWithA(value: number, cycles = 4): number {
    const result = this.registers.A - value;
    this.registers.flagZ = (result & 0xFF) === 0;
    this.registers.flagN = true;
    this.registers.flagH = (this.registers.A & 0x0F) < (value & 0x0F);
    this.registers.flagC = result < 0;
    return cycles;
  }

  // 16-bit arithmetic operations
  private inc_BC(): number { this.registers.BC = (this.registers.BC + 1) & 0xFFFF; return 8; }
  private inc_DE(): number { this.registers.DE = (this.registers.DE + 1) & 0xFFFF; return 8; }
  private inc_HL(): number { this.registers.HL = (this.registers.HL + 1) & 0xFFFF; return 8; }
  private inc_SP(): number { this.registers.SP = (this.registers.SP + 1) & 0xFFFF; return 8; }
  
  private dec_BC(): number { this.registers.BC = (this.registers.BC - 1) & 0xFFFF; return 8; }
  private dec_DE(): number { this.registers.DE = (this.registers.DE - 1) & 0xFFFF; return 8; }
  private dec_HL(): number { this.registers.HL = (this.registers.HL - 1) & 0xFFFF; return 8; }
  private dec_SP(): number { this.registers.SP = (this.registers.SP - 1) & 0xFFFF; return 8; }

  // 16-bit ADD HL operations
  private add_HL_BC(): number { return this.add16ToHL(this.registers.BC); }
  private add_HL_DE(): number { return this.add16ToHL(this.registers.DE); }
  private add_HL_HL(): number { return this.add16ToHL(this.registers.HL); }
  private add_HL_SP(): number { return this.add16ToHL(this.registers.SP); }

  private add16ToHL(value: number): number {
    const result = this.registers.HL + value;
    this.registers.flagN = false;
    this.registers.flagH = (this.registers.HL & 0x0FFF) + (value & 0x0FFF) > 0x0FFF;
    this.registers.flagC = result > 0xFFFF;
    this.registers.HL = result & 0xFFFF;
    return 8;
  }

  // Memory operations
  private inc_HL_addr(): number {
    const value = this.memory.read8(this.registers.HL);
    const result = (value + 1) & 0xFF;
    this.memory.write8(this.registers.HL, result);
    this.registers.flagZ = result === 0;
    this.registers.flagN = false;
    this.registers.flagH = (value & 0x0F) === 0x0F;
    return 12;
  }

  private dec_HL_addr(): number {
    const value = this.memory.read8(this.registers.HL);
    const result = (value - 1) & 0xFF;
    this.memory.write8(this.registers.HL, result);
    this.registers.flagZ = result === 0;
    this.registers.flagN = true;
    this.registers.flagH = (value & 0x0F) === 0;
    return 12;
  }

  // Rotate operations
  private rlca(): number {
    const carry = (this.registers.A & 0x80) >> 7;
    this.registers.A = ((this.registers.A << 1) | carry) & 0xFF;
    this.registers.flagZ = false;
    this.registers.flagN = false;
    this.registers.flagH = false;
    this.registers.flagC = carry === 1;
    return 4;
  }

  private rrca(): number {
    const carry = this.registers.A & 0x01;
    this.registers.A = ((this.registers.A >> 1) | (carry << 7)) & 0xFF;
    this.registers.flagZ = false;
    this.registers.flagN = false;
    this.registers.flagH = false;
    this.registers.flagC = carry === 1;
    return 4;
  }

  private rla(): number {
    const oldCarry = this.registers.flagC ? 1 : 0;
    const newCarry = (this.registers.A & 0x80) >> 7;
    this.registers.A = ((this.registers.A << 1) | oldCarry) & 0xFF;
    this.registers.flagZ = false;
    this.registers.flagN = false;
    this.registers.flagH = false;
    this.registers.flagC = newCarry === 1;
    return 4;
  }

  private rra(): number {
    const oldCarry = this.registers.flagC ? 1 : 0;
    const newCarry = this.registers.A & 0x01;
    this.registers.A = ((this.registers.A >> 1) | (oldCarry << 7)) & 0xFF;
    this.registers.flagZ = false;
    this.registers.flagN = false;
    this.registers.flagH = false;
    this.registers.flagC = newCarry === 1;
    return 4;
  }

  // Complement operations
  private cpl(): number {
    this.registers.A = (~this.registers.A) & 0xFF;
    this.registers.flagN = true;
    this.registers.flagH = true;
    return 4;
  }

  private scf(): number {
    this.registers.flagN = false;
    this.registers.flagH = false;
    this.registers.flagC = true;
    return 4;
  }

  private ccf(): number {
    this.registers.flagN = false;
    this.registers.flagH = false;
    this.registers.flagC = !this.registers.flagC;
    return 4;
  }

  // DAA (Decimal Adjust Accumulator)
  private daa(): number {
    let adjust = 0;
    let carry = false;

    if (this.registers.flagH || (!this.registers.flagN && (this.registers.A & 0x0F) > 0x09)) {
      adjust += 0x06;
    }

    if (this.registers.flagC || (!this.registers.flagN && this.registers.A > 0x99)) {
      adjust += 0x60;
      carry = true;
    }

    if (this.registers.flagN) {
      this.registers.A = (this.registers.A - adjust) & 0xFF;
    } else {
      this.registers.A = (this.registers.A + adjust) & 0xFF;
    }

    this.registers.flagZ = this.registers.A === 0;
    this.registers.flagH = false;
    this.registers.flagC = carry;
    return 4;
  }

  // Interrupt control
  private di(): number {
    // DI - Disable Interrupts
    this._interruptMasterEnable = false;
    this._pendingEnableInterrupt = false; // Cancel any pending EI
    return 4;
  }

  private ei(): number {
    // EI - Enable Interrupts (delayed by one instruction)
    this._pendingEnableInterrupt = true;
    return 4;
  }

  // Immediate arithmetic operations
  private and_n(): number {
    const value = this.fetchImmediate8();
    return this.andWithA(value, 8);
  }

  private xor_n(): number {
    const value = this.fetchImmediate8();
    return this.xorWithA(value, 8);
  }

  private or_n(): number {
    const value = this.fetchImmediate8();
    return this.orWithA(value, 8);
  }

  private sub_n(): number {
    const value = this.fetchImmediate8();
    return this.subFromA(value, 8);
  }

  // Stack pointer operations
  private ld_HL_SP_n(): number {
    const offset = this.fetchImmediate8();
    const signedOffset = offset > 127 ? offset - 256 : offset; // Convert to signed
    const result = this.registers.SP + signedOffset;
    
    this.registers.flagZ = false;
    this.registers.flagN = false;
    this.registers.flagH = (this.registers.SP & 0x0F) + (offset & 0x0F) > 0x0F;
    this.registers.flagC = (this.registers.SP & 0xFF) + offset > 0xFF;
    
    this.registers.HL = result & 0xFFFF;
    return 12;
  }

  private ld_SP_HL(): number {
    this.registers.SP = this.registers.HL;
    return 8;
  }

  private add_SP_n(): number {
    const offset = this.fetchImmediate8();
    const signedOffset = offset > 127 ? offset - 256 : offset; // Convert to signed
    
    this.registers.flagZ = false;
    this.registers.flagN = false;
    this.registers.flagH = (this.registers.SP & 0x0F) + (offset & 0x0F) > 0x0F;
    this.registers.flagC = (this.registers.SP & 0xFF) + offset > 0xFF;
    
    this.registers.SP = (this.registers.SP + signedOffset) & 0xFFFF;
    return 16;
  }

  // Jump operations
  private jp_HL(): number {
    this.registers.PC = this.registers.HL;
    return 4;
  }

  // Conditional returns
  private ret_NZ(): number {
    if (!this.registers.flagZ) {
      this.registers.PC = this.popStack();
      return 20;
    }
    return 8;
  }

  private ret_Z(): number {
    if (this.registers.flagZ) {
      this.registers.PC = this.popStack();
      return 20;
    }
    return 8;
  }

  private ret_NC(): number {
    if (!this.registers.flagC) {
      this.registers.PC = this.popStack();
      return 20;
    }
    return 8;
  }

  private ret_C(): number {
    if (this.registers.flagC) {
      this.registers.PC = this.popStack();
      return 20;
    }
    return 8;
  }

  // Conditional jumps
  private jp_NZ_nn(): number {
    const address = this.fetchImmediate16();
    if (!this.registers.flagZ) {
      this.registers.PC = address;
      return 16;
    }
    return 12;
  }

  private jp_Z_nn(): number {
    const address = this.fetchImmediate16();
    if (this.registers.flagZ) {
      this.registers.PC = address;
      return 16;
    }
    return 12;
  }

  private jp_NC_nn(): number {
    const address = this.fetchImmediate16();
    if (!this.registers.flagC) {
      this.registers.PC = address;
      return 16;
    }
    return 12;
  }

  private jp_C_nn(): number {
    const address = this.fetchImmediate16();
    if (this.registers.flagC) {
      this.registers.PC = address;
      return 16;
    }
    return 12;
  }

  // Conditional calls
  private call_NZ_nn(): number {
    const address = this.fetchImmediate16();
    if (!this.registers.flagZ) {
      this.pushStack(this.registers.PC);
      this.registers.PC = address;
      return 24;
    }
    return 12;
  }

  private call_Z_nn(): number {
    const address = this.fetchImmediate16();
    if (this.registers.flagZ) {
      this.pushStack(this.registers.PC);
      this.registers.PC = address;
      return 24;
    }
    return 12;
  }

  private call_NC_nn(): number {
    const address = this.fetchImmediate16();
    if (!this.registers.flagC) {
      this.pushStack(this.registers.PC);
      this.registers.PC = address;
      return 24;
    }
    return 12;
  }

  private call_C_nn(): number {
    const address = this.fetchImmediate16();
    if (this.registers.flagC) {
      this.pushStack(this.registers.PC);
      this.registers.PC = address;
      return 24;
    }
    return 12;
  }

  // ADC (Add with carry) operations
  private adc_B(): number { return this.adcToA(this.registers.B); }
  private adc_C(): number { return this.adcToA(this.registers.C); }
  private adc_D(): number { return this.adcToA(this.registers.D); }
  private adc_E(): number { return this.adcToA(this.registers.E); }
  private adc_H(): number { return this.adcToA(this.registers.H); }
  private adc_L(): number { return this.adcToA(this.registers.L); }
  private adc_HL(): number { return this.adcToA(this.memory.read8(this.registers.HL), 8); }
  private adc_A(): number { return this.adcToA(this.registers.A); }

  private adcToA(value: number, cycles = 4): number {
    const carry = this.registers.flagC ? 1 : 0;
    const result = this.registers.A + value + carry;
    
    this.registers.flagZ = (result & 0xFF) === 0;
    this.registers.flagN = false;
    this.registers.flagH = (this.registers.A & 0x0F) + (value & 0x0F) + carry > 0x0F;
    this.registers.flagC = result > 0xFF;
    
    this.registers.A = result & 0xFF;
    return cycles;
  }

  // SBC (Subtract with carry) operations
  private sbc_B(): number { return this.sbcFromA(this.registers.B); }
  private sbc_C(): number { return this.sbcFromA(this.registers.C); }
  private sbc_D(): number { return this.sbcFromA(this.registers.D); }
  private sbc_E(): number { return this.sbcFromA(this.registers.E); }
  private sbc_H(): number { return this.sbcFromA(this.registers.H); }
  private sbc_L(): number { return this.sbcFromA(this.registers.L); }
  private sbc_HL(): number { return this.sbcFromA(this.memory.read8(this.registers.HL), 8); }
  private sbc_A(): number { return this.sbcFromA(this.registers.A); }

  private sbcFromA(value: number, cycles = 4): number {
    const carry = this.registers.flagC ? 1 : 0;
    const result = this.registers.A - value - carry;
    
    this.registers.flagZ = (result & 0xFF) === 0;
    this.registers.flagN = true;
    this.registers.flagH = (this.registers.A & 0x0F) < (value & 0x0F) + carry;
    this.registers.flagC = result < 0;
    
    this.registers.A = result & 0xFF;
    return cycles;
  }

  // More immediate arithmetic
  private adc_n(): number {
    const value = this.fetchImmediate8();
    return this.adcToA(value, 8);
  }

  private sbc_n(): number {
    const value = this.fetchImmediate8();
    return this.sbcFromA(value, 8);
  }

  // RST (Restart) instructions
  private rst_00(): number { this.pushStack(this.registers.PC); this.registers.PC = 0x00; return 16; }
  private rst_08(): number { this.pushStack(this.registers.PC); this.registers.PC = 0x08; return 16; }
  private rst_10(): number { this.pushStack(this.registers.PC); this.registers.PC = 0x10; return 16; }
  private rst_18(): number { this.pushStack(this.registers.PC); this.registers.PC = 0x18; return 16; }
  private rst_20(): number { this.pushStack(this.registers.PC); this.registers.PC = 0x20; return 16; }
  private rst_28(): number { this.pushStack(this.registers.PC); this.registers.PC = 0x28; return 16; }
  private rst_30(): number { this.pushStack(this.registers.PC); this.registers.PC = 0x30; return 16; }
  private rst_38(): number { this.pushStack(this.registers.PC); this.registers.PC = 0x38; return 16; }

  // Special memory operations
  private ld_nn_SP(): number {
    const address = this.fetchImmediate16();
    this.memory.write16(address, this.registers.SP);
    return 20;
  }

  private stop(): number {
    // STOP instruction - similar to HALT but different behavior
    this._isHalted = true;
    return 4;
  }

  // LD (HL),r instructions - store register value to memory address in HL
  private ld_HL_B(): number {
    this.memory.write8(this.registers.HL, this.registers.B);
    return 8;
  }

  private ld_HL_C(): number {
    this.memory.write8(this.registers.HL, this.registers.C);
    return 8;
  }

  private ld_HL_D(): number {
    this.memory.write8(this.registers.HL, this.registers.D);
    return 8;
  }

  private ld_HL_E(): number {
    this.memory.write8(this.registers.HL, this.registers.E);
    return 8;
  }

  private ld_HL_H(): number {
    this.memory.write8(this.registers.HL, this.registers.H);
    return 8;
  }

  private ld_HL_L(): number {
    this.memory.write8(this.registers.HL, this.registers.L);
    return 8;
  }

  // High memory operations using C register
  private ld_FF00_C_A(): number {
    // LD (0xFF00+C),A - Store A at high memory address 0xFF00 + C
    this.memory.write8(0xFF00 + this.registers.C, this.registers.A);
    return 8;
  }

  private ld_A_FF00_C(): number {
    // LD A,(0xFF00+C) - Load A from high memory address 0xFF00 + C
    this.registers.A = this.memory.read8(0xFF00 + this.registers.C);
    return 8;
  }

  /**
   * Execute CB-prefixed instruction
   * CB instructions are 2-byte instructions where the first byte is 0xCB
   * and the second byte specifies the actual operation
   */
  private executeCBInstruction(): number {
    const cbOpcode = this.fetchImmediate8();
    
    // CB instructions follow a pattern:
    // Bits 7-6: Operation type (00=shifts, 01=BIT, 10=RES, 11=SET)
    // Bits 5-3: Bit number (for BIT/RES/SET) or operation subtype
    // Bits 2-0: Register (B=000, C=001, D=010, E=011, H=100, L=101, (HL)=110, A=111)
    
    const operation = (cbOpcode >> 6) & 0x03;
    const bitNumber = (cbOpcode >> 3) & 0x07;
    const register = cbOpcode & 0x07;
    
    switch (operation) {
      case 0x00: // Shift/rotate operations
        return this.executeCBShiftRotate(cbOpcode, bitNumber, register);
      case 0x01: // BIT operations
        return this.executeCBBit(bitNumber, register);
      case 0x02: // RES operations (reset bit)
        return this.executeCBRes(bitNumber, register);
      case 0x03: // SET operations (set bit)
        return this.executeCBSet(bitNumber, register);
      default:
        throw new Error(`Unknown CB operation: 0x${cbOpcode.toString(16).padStart(2, '0')}`);
    }
  }

  /**
   * Execute CB shift/rotate instructions
   */
  private executeCBShiftRotate(cbOpcode: number, subOp: number, register: number): number {
    let value = this.getCBRegisterValue(register);
    let result = 0;
    let cycles = register === 6 ? 16 : 8; // (HL) takes more cycles
    
    switch (subOp) {
      case 0x00: // RLC - Rotate left circular
        result = ((value << 1) | (value >> 7)) & 0xFF;
        this.registers.flagC = (value & 0x80) !== 0;
        break;
      case 0x01: // RRC - Rotate right circular
        result = ((value >> 1) | (value << 7)) & 0xFF;
        this.registers.flagC = (value & 0x01) !== 0;
        break;
      case 0x02: // RL - Rotate left through carry
        result = ((value << 1) | (this.registers.flagC ? 1 : 0)) & 0xFF;
        this.registers.flagC = (value & 0x80) !== 0;
        break;
      case 0x03: // RR - Rotate right through carry
        result = ((value >> 1) | (this.registers.flagC ? 0x80 : 0)) & 0xFF;
        this.registers.flagC = (value & 0x01) !== 0;
        break;
      case 0x04: // SLA - Shift left arithmetic
        result = (value << 1) & 0xFF;
        this.registers.flagC = (value & 0x80) !== 0;
        break;
      case 0x05: // SRA - Shift right arithmetic (preserve MSB)
        result = ((value >> 1) | (value &  0x80)) & 0xFF;
        this.registers.flagC = (value & 0x01) !== 0;
        break;
      case 0x06: // SWAP - Swap nibbles
        result = ((value << 4) | (value >> 4)) & 0xFF;
        this.registers.flagC = false;
        break;
      case 0x07: // SRL - Shift right logical
        result = (value >> 1) & 0xFF;
        this.registers.flagC = (value & 0x01) !== 0;
        break;
      default:
        throw new Error(`Unknown CB shift/rotate: 0x${cbOpcode.toString(16).padStart(2, '0')}`);
    }
    
    this.registers.flagZ = result === 0;
    this.registers.flagN = false;
    this.registers.flagH = false;
    
    this.setCBRegisterValue(register, result);
    return cycles;
  }

  /**
   * Execute BIT instruction - test bit
   */
  private executeCBBit(bitNumber: number, register: number): number {
    const value = this.getCBRegisterValue(register);
    const bitSet = (value & (1 << bitNumber)) !== 0;
    
    this.registers.flagZ = !bitSet;
    this.registers.flagN = false;
    this.registers.flagH = true;
    
    return register === 6 ? 12 : 8; // (HL) takes more cycles
  }

  /**
   * Execute RES instruction - reset bit
   */
  private executeCBRes(bitNumber: number, register: number): number {
    const value = this.getCBRegisterValue(register);
    const result = value & ~(1 << bitNumber);
    
    this.setCBRegisterValue(register, result);
    return register === 6 ? 16 : 8; // (HL) takes more cycles
  }

  /**
   * Execute SET instruction - set bit
   */
  private executeCBSet(bitNumber: number, register: number): number {
    const value = this.getCBRegisterValue(register);
    const result = value | (1 << bitNumber);
    
    this.setCBRegisterValue(register, result);
    return register === 6 ? 16 : 8; // (HL) takes more cycles
  }

  /**
   * Get register value for CB instructions
   */
  private getCBRegisterValue(register: number): number {
    switch (register) {
      case 0: return this.registers.B;
      case 1: return this.registers.C;
      case 2: return this.registers.D;
      case 3: return this.registers.E;
      case 4: return this.registers.H;
      case 5: return this.registers.L;
      case 6: return this.memory.read8(this.registers.HL); // (HL)
      case 7: return this.registers.A;
      default: throw new Error(`Invalid CB register: ${register}`);
    }
  }

  /**
   * Set register value for CB instructions
   */
  private setCBRegisterValue(register: number, value: number): void {
    switch (register) {
      case 0: this.registers.B = value; break;
      case 1: this.registers.C = value; break;
      case 2: this.registers.D = value; break;
      case 3: this.registers.E = value; break;
      case 4: this.registers.H = value; break;
      case 5: this.registers.L = value; break;
      case 6: this.memory.write8(this.registers.HL, value); break; // (HL)
      case 7: this.registers.A = value; break;
      default: throw new Error(`Invalid CB register: ${register}`);
    }
  }
}
