import { describe, it, expect, beforeEach } from 'vitest';
import { CPU } from './cpu';
import { MemoryBus } from '../memory/memory-bus';

describe('CPU', () => {
  let cpu: CPU;
  let memory: MemoryBus;

  beforeEach(() => {
    memory = new MemoryBus();
    cpu = new CPU(memory);
  });

  describe('initialization', () => {
    it('should initialize with post-boot register state', () => {
      expect(cpu.registers.A).toBe(0x01);
      expect(cpu.registers.BC).toBe(0x0013);
      expect(cpu.registers.DE).toBe(0x00D8);
      expect(cpu.registers.HL).toBe(0x014D);
      expect(cpu.registers.PC).toBe(0x0100);
      expect(cpu.registers.SP).toBe(0xFFFE);
    });

    it('should initialize with correct flag state', () => {
      expect(cpu.registers.flagZ).toBe(true);
      expect(cpu.registers.flagN).toBe(false);
      expect(cpu.registers.flagH).toBe(true);
      expect(cpu.registers.flagC).toBe(true);
    });

    it('should start with zero cycles elapsed', () => {
      expect(cpu.totalCycles).toBe(0);
    });
  });

  describe('basic instruction execution', () => {
    it('should fetch instruction from PC', () => {
      memory.write8(0x0100, 0x00); // NOP instruction
      const instruction = cpu.fetchInstruction();
      expect(instruction).toBe(0x00);
      expect(cpu.registers.PC).toBe(0x0101); // PC should increment
    });

    it('should execute NOP instruction (0x00)', () => {
      memory.write8(0x0100, 0x00); // NOP
      const cyclesBefore = cpu.totalCycles;
      
      cpu.step();
      
      expect(cpu.totalCycles).toBe(cyclesBefore + 4); // NOP takes 4 cycles
      expect(cpu.registers.PC).toBe(0x0101);
    });

    it('should execute multiple steps', () => {
      memory.write8(0x0100, 0x00); // NOP
      memory.write8(0x0101, 0x00); // NOP
      memory.write8(0x0102, 0x00); // NOP
      
      cpu.step(); // First NOP
      cpu.step(); // Second NOP
      cpu.step(); // Third NOP
      
      expect(cpu.registers.PC).toBe(0x0103);
      expect(cpu.totalCycles).toBe(12); // 3 NOPs × 4 cycles each
    });
  });

  describe('8-bit load instructions', () => {
    it('should execute LD B,n (0x06)', () => {
      // Write test code to Work RAM and set PC to point there
      memory.write8(0xC000, 0x06); // LD B,n
      memory.write8(0xC001, 0x42); // n = 0x42
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.B).toBe(0x42);
      expect(cpu.registers.PC).toBe(0xC002);
      expect(cpu.totalCycles).toBe(8); // LD B,n takes 8 cycles
    });

    it('should execute LD C,n (0x0E)', () => {
      memory.write8(0xC000, 0x0E); // LD C,n
      memory.write8(0xC001, 0x73); // n = 0x73
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.C).toBe(0x73);
      expect(cpu.registers.PC).toBe(0xC002);
      expect(cpu.totalCycles).toBe(8);
    });

    it('should execute LD A,B (0x78)', () => {
      cpu.registers.B = 0x55;
      memory.write8(0xC000, 0x78); // LD A,B
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.A).toBe(0x55);
      expect(cpu.registers.PC).toBe(0xC001);
      expect(cpu.totalCycles).toBe(4); // LD A,B takes 4 cycles
    });
  });

  describe('16-bit load instructions', () => {
    it('should execute LD BC,nn (0x01)', () => {
      memory.write8(0xC000, 0x01); // LD BC,nn
      memory.write8(0xC001, 0x34); // Low byte
      memory.write8(0xC002, 0x12); // High byte
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.BC).toBe(0x1234);
      expect(cpu.registers.PC).toBe(0xC003);
      expect(cpu.totalCycles).toBe(12); // LD BC,nn takes 12 cycles
    });
  });

  describe('halt instruction', () => {
    it('should execute HALT (0x76)', () => {
      memory.write8(0xC000, 0x76); // HALT
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.isHalted).toBe(true);
      expect(cpu.registers.PC).toBe(0xC001);
      expect(cpu.totalCycles).toBe(4); // HALT takes 4 cycles
    });

    it('should not increment PC when halted', () => {
      memory.write8(0xC000, 0x76); // HALT
      cpu.registers.PC = 0xC000;
      
      cpu.step(); // Execute HALT
      const pcAfterHalt = cpu.registers.PC;
      
      cpu.step(); // Try to step while halted
      
      expect(cpu.registers.PC).toBe(pcAfterHalt); // PC shouldn't change
      expect(cpu.isHalted).toBe(true);
    });
  });

  describe('jump instructions', () => {
    it('should execute JP nn (0xC3)', () => {
      memory.write8(0xC000, 0xC3); // JP nn
      memory.write8(0xC001, 0x00); // Low byte
      memory.write8(0xC002, 0x80); // High byte -> 0x8000
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.PC).toBe(0x8000);
      expect(cpu.totalCycles).toBe(16); // JP takes 16 cycles
    });

    it('should execute JR n (0x18)', () => {
      memory.write8(0xC000, 0x18); // JR n
      memory.write8(0xC001, 0x05); // Jump forward 5 bytes
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.PC).toBe(0xC007); // 0xC002 + 5
      expect(cpu.totalCycles).toBe(12); // JR takes 12 cycles
    });

    it('should execute JR with negative offset', () => {
      memory.write8(0xC010, 0x18); // JR n
      memory.write8(0xC011, 0xFE); // Jump back 2 bytes (-2 in signed)
      cpu.registers.PC = 0xC010;
      
      cpu.step();
      
      expect(cpu.registers.PC).toBe(0xC010); // 0xC012 - 2
      expect(cpu.totalCycles).toBe(12);
    });
  });

  describe('arithmetic instructions', () => {
    it('should execute INC A (0x3C)', () => {
      cpu.registers.A = 0x42;
      memory.write8(0xC000, 0x3C); // INC A
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.A).toBe(0x43);
      expect(cpu.registers.flagZ).toBe(false);
      expect(cpu.registers.flagN).toBe(false);
      expect(cpu.totalCycles).toBe(4);
    });

    it('should execute DEC A (0x3D)', () => {
      cpu.registers.A = 0x42;
      memory.write8(0xC000, 0x3D); // DEC A
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.A).toBe(0x41);
      expect(cpu.registers.flagZ).toBe(false);
      expect(cpu.registers.flagN).toBe(true);
      expect(cpu.totalCycles).toBe(4);
    });

    it('should execute ADD A,n (0xC6)', () => {
      cpu.registers.A = 0x10;
      memory.write8(0xC000, 0xC6); // ADD A,n
      memory.write8(0xC001, 0x05); // n = 5
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.A).toBe(0x15);
      expect(cpu.registers.flagZ).toBe(false);
      expect(cpu.registers.flagN).toBe(false);
      expect(cpu.totalCycles).toBe(8);
    });

    it('should execute CP n (0xFE) - compare', () => {
      cpu.registers.A = 0x42;
      memory.write8(0xC000, 0xFE); // CP n
      memory.write8(0xC001, 0x42); // n = 0x42 (equal)
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.A).toBe(0x42); // A unchanged
      expect(cpu.registers.flagZ).toBe(true); // Equal sets Z flag
      expect(cpu.registers.flagN).toBe(true); // CP always sets N flag
      expect(cpu.totalCycles).toBe(8);
    });
  });

  describe('memory instructions', () => {
    it('should execute LD A,(HL) (0x7E)', () => {
      cpu.registers.HL = 0xC100;
      memory.write8(0xC100, 0x55); // Value at address HL
      memory.write8(0xC000, 0x7E); // LD A,(HL)
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.A).toBe(0x55);
      expect(cpu.totalCycles).toBe(8);
    });

    it('should execute LD (HL),A (0x77)', () => {
      cpu.registers.A = 0x33;
      cpu.registers.HL = 0xC100;
      memory.write8(0xC000, 0x77); // LD (HL),A
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(memory.read8(0xC100)).toBe(0x33);
      expect(cpu.totalCycles).toBe(8);
    });

    it('should execute LD (nn),A (0xEA)', () => {
      cpu.registers.A = 0x44;
      memory.write8(0xC000, 0xEA); // LD (nn),A
      memory.write8(0xC001, 0x00); // Low byte of address
      memory.write8(0xC002, 0xC1); // High byte -> 0xC100
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(memory.read8(0xC100)).toBe(0x44);
      expect(cpu.totalCycles).toBe(16);
    });
  });

  describe('stack instructions', () => {
    it('should execute PUSH BC (0xC5)', () => {
      cpu.registers.BC = 0x1234;
      cpu.registers.SP = 0xFFFE;
      memory.write8(0xC000, 0xC5); // PUSH BC
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.SP).toBe(0xFFFC); // SP decremented by 2
      expect(memory.read16(0xFFFC)).toBe(0x1234); // BC pushed to stack
      expect(cpu.totalCycles).toBe(16);
    });

    it('should execute POP BC (0xC1)', () => {
      cpu.registers.SP = 0xFFFC;
      memory.write16(0xFFFC, 0x5678); // Value on stack
      memory.write8(0xC000, 0xC1); // POP BC
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.BC).toBe(0x5678);
      expect(cpu.registers.SP).toBe(0xFFFE); // SP incremented by 2
      expect(cpu.totalCycles).toBe(12);
    });

    it('should execute CALL nn (0xCD)', () => {
      cpu.registers.SP = 0xFFFE;
      cpu.registers.PC = 0xC000;
      memory.write8(0xC000, 0xCD); // CALL nn
      memory.write8(0xC001, 0x00); // Low byte
      memory.write8(0xC002, 0x80); // High byte -> 0x8000
      
      cpu.step();
      
      expect(cpu.registers.PC).toBe(0x8000); // Jumped to address
      expect(cpu.registers.SP).toBe(0xFFFC); // SP decremented
      expect(memory.read16(0xFFFC)).toBe(0xC003); // Return address pushed
      expect(cpu.totalCycles).toBe(24);
    });

    it('should execute RET (0xC9)', () => {
      cpu.registers.SP = 0xFFFC;
      memory.write16(0xFFFC, 0xC123); // Return address on stack
      memory.write8(0xC000, 0xC9); // RET
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.PC).toBe(0xC123); // Returned to address
      expect(cpu.registers.SP).toBe(0xFFFE); // SP incremented
      expect(cpu.totalCycles).toBe(16);
    });
  });

  describe('conditional jumps', () => {
    it('should execute JR Z,n when Z flag is set', () => {
      cpu.registers.flagZ = true;
      memory.write8(0xC000, 0x28); // JR Z,n
      memory.write8(0xC001, 0x05); // Jump forward 5
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.PC).toBe(0xC007); // Jump taken
      expect(cpu.totalCycles).toBe(12); // Branch taken
    });

    it('should execute JR Z,n when Z flag is clear (no jump)', () => {
      cpu.registers.flagZ = false;
      memory.write8(0xC000, 0x28); // JR Z,n
      memory.write8(0xC001, 0x05); // Jump forward 5
      cpu.registers.PC = 0xC000;
      
      cpu.step();
      
      expect(cpu.registers.PC).toBe(0xC002); // No jump, just advance
      expect(cpu.totalCycles).toBe(8); // Branch not taken
    });
  });

  describe('CB-prefixed instructions', () => {
    it('should execute BIT instruction (CB 40 - BIT 0,B)', () => {
      // Set up: LD B,0x01 then BIT 0,B
      memory.write8(0xC000, 0x06); // LD B,n
      memory.write8(0xC001, 0x01); // n = 0x01
      memory.write8(0xC002, 0xCB); // CB prefix
      memory.write8(0xC003, 0x40); // BIT 0,B
      cpu.registers.PC = 0xC000;
      
      cpu.step(); // Execute LD B,0x01
      expect(cpu.registers.B).toBe(0x01);
      
      cpu.step(); // Execute BIT 0,B
      expect(cpu.registers.flagZ).toBe(false); // Bit 0 is set, so Z=0
      expect(cpu.registers.flagN).toBe(false);
      expect(cpu.registers.flagH).toBe(true);
    });

    it('should execute RLC instruction (CB 07 - RLC A)', () => {
      // Set up: LD A,0x80 then RLC A
      memory.write8(0xC000, 0x3E); // LD A,n
      memory.write8(0xC001, 0x80); // n = 0x80
      memory.write8(0xC002, 0xCB); // CB prefix
      memory.write8(0xC003, 0x07); // RLC A
      cpu.registers.PC = 0xC000;
      
      cpu.step(); // Execute LD A,0x80
      expect(cpu.registers.A).toBe(0x80);
      
      cpu.step(); // Execute RLC A
      expect(cpu.registers.A).toBe(0x01); // 0x80 rotated left = 0x01
      expect(cpu.registers.flagC).toBe(true); // MSB was set
      expect(cpu.registers.flagZ).toBe(false);
    });

    it('should execute SET instruction (CB F7 - SET 6,A)', () => {
      // Set up: LD A,0x00 then SET 6,A
      memory.write8(0xC000, 0x3E); // LD A,n
      memory.write8(0xC001, 0x00); // n = 0x00
      memory.write8(0xC002, 0xCB); // CB prefix
      memory.write8(0xC003, 0xF7); // SET 6,A
      cpu.registers.PC = 0xC000;
      
      cpu.step(); // Execute LD A,0x00
      expect(cpu.registers.A).toBe(0x00);
      
      cpu.step(); // Execute SET 6,A
      expect(cpu.registers.A).toBe(0x40); // Bit 6 set = 0x40
    });
  });

  describe('arithmetic and logical operations', () => {
    it('should execute OR B instruction (0xB0)', () => {
      // Set up: LD A,0x0F; LD B,0xF0; OR B
      memory.write8(0xC000, 0x3E); // LD A,n
      memory.write8(0xC001, 0x0F); // n = 0x0F
      memory.write8(0xC002, 0x06); // LD B,n
      memory.write8(0xC003, 0xF0); // n = 0xF0
      memory.write8(0xC004, 0xB0); // OR B
      cpu.registers.PC = 0xC000;
      
      cpu.step(); // Execute LD A,0x0F
      cpu.step(); // Execute LD B,0xF0
      expect(cpu.registers.A).toBe(0x0F);
      expect(cpu.registers.B).toBe(0xF0);
      
      cpu.step(); // Execute OR B
      expect(cpu.registers.A).toBe(0xFF); // 0x0F | 0xF0 = 0xFF
      expect(cpu.registers.flagZ).toBe(false);
      expect(cpu.registers.flagN).toBe(false);
      expect(cpu.registers.flagH).toBe(false);
      expect(cpu.registers.flagC).toBe(false);
    });

    it('should execute AND B instruction (0xA0)', () => {
      // Set up: LD A,0xFF; LD B,0x0F; AND B
      memory.write8(0xC000, 0x3E); // LD A,n
      memory.write8(0xC001, 0xFF); // n = 0xFF
      memory.write8(0xC002, 0x06); // LD B,n
      memory.write8(0xC003, 0x0F); // n = 0x0F
      memory.write8(0xC004, 0xA0); // AND B
      cpu.registers.PC = 0xC000;
      
      cpu.step(); // Execute LD A,0xFF
      cpu.step(); // Execute LD B,0x0F
      expect(cpu.registers.A).toBe(0xFF);
      expect(cpu.registers.B).toBe(0x0F);
      
      cpu.step(); // Execute AND B
      expect(cpu.registers.A).toBe(0x0F); // 0xFF & 0x0F = 0x0F
      expect(cpu.registers.flagZ).toBe(false);
      expect(cpu.registers.flagN).toBe(false);
      expect(cpu.registers.flagH).toBe(true);
      expect(cpu.registers.flagC).toBe(false);
    });

    it('should execute CP B instruction (0xB8)', () => {
      // Set up: LD A,0x10; LD B,0x0F; CP B
      memory.write8(0xC000, 0x3E); // LD A,n
      memory.write8(0xC001, 0x10); // n = 0x10
      memory.write8(0xC002, 0x06); // LD B,n
      memory.write8(0xC003, 0x0F); // n = 0x0F
      memory.write8(0xC004, 0xB8); // CP B
      cpu.registers.PC = 0xC000;
      
      cpu.step(); // Execute LD A,0x10
      cpu.step(); // Execute LD B,0x0F
      expect(cpu.registers.A).toBe(0x10);
      expect(cpu.registers.B).toBe(0x0F);
      
      cpu.step(); // Execute CP B
      expect(cpu.registers.A).toBe(0x10); // CP doesn't modify A
      expect(cpu.registers.flagZ).toBe(false); // 0x10 - 0x0F != 0
      expect(cpu.registers.flagN).toBe(true); // CP sets N flag
      expect(cpu.registers.flagC).toBe(false); // 0x10 >= 0x0F, no borrow
    });
  });
});
