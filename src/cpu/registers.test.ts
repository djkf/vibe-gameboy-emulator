import { describe, it, expect } from 'vitest';
import { Registers } from './registers';

describe('Registers', () => {
  describe('8-bit registers', () => {
    it('should initialize A register to 0x01 (post-boot state)', () => {
      const registers = new Registers();
      expect(registers.A).toBe(0x01);
    });

    it('should initialize other registers to post-boot state', () => {
      const registers = new Registers();
      expect(registers.B).toBe(0x00);
      expect(registers.C).toBe(0x13);
      expect(registers.D).toBe(0x00);
      expect(registers.E).toBe(0xD8);
      expect(registers.H).toBe(0x01);
      expect(registers.L).toBe(0x4D);
    });

    it('should allow setting and getting 8-bit register values', () => {
      const registers = new Registers();
      registers.A = 0xFF;
      expect(registers.A).toBe(0xFF);
    });

    it('should wrap around 8-bit values', () => {
      const registers = new Registers();
      registers.A = 0x100; // Should wrap to 0x00
      expect(registers.A).toBe(0x00);
    });
  });

  describe('16-bit register pairs', () => {
    it('should combine B and C into BC', () => {
      const registers = new Registers();
      registers.B = 0x12;
      registers.C = 0x34;
      expect(registers.BC).toBe(0x1234);
    });

    it('should combine D and E into DE', () => {
      const registers = new Registers();
      registers.D = 0xAB;
      registers.E = 0xCD;
      expect(registers.DE).toBe(0xABCD);
    });

    it('should combine H and L into HL', () => {
      const registers = new Registers();
      registers.H = 0xFF;
      registers.L = 0x00;
      expect(registers.HL).toBe(0xFF00);
    });

    it('should allow setting 16-bit register pairs', () => {
      const registers = new Registers();
      registers.BC = 0x5678;
      expect(registers.B).toBe(0x56);
      expect(registers.C).toBe(0x78);
    });
  });

  describe('flags register', () => {
    it('should initialize flags to post-boot state (Z=1, N=0, H=1, C=1)', () => {
      const registers = new Registers();
      expect(registers.flagZ).toBe(true);
      expect(registers.flagN).toBe(false);
      expect(registers.flagH).toBe(true);
      expect(registers.flagC).toBe(true);
    });

    it('should set and clear individual flags', () => {
      const registers = new Registers();
      registers.flagZ = false;
      registers.flagN = true;
      expect(registers.flagZ).toBe(false);
      expect(registers.flagN).toBe(true);
    });

    it('should represent flags as F register bits', () => {
      const registers = new Registers();
      registers.flagZ = true;  // bit 7
      registers.flagN = false; // bit 6
      registers.flagH = true;  // bit 5
      registers.flagC = false; // bit 4
      expect(registers.F).toBe(0xA0); // 10100000
    });
  });

  describe('program counter and stack pointer', () => {
    it('should initialize PC to 0x0100 (post-boot state)', () => {
      const registers = new Registers();
      expect(registers.PC).toBe(0x0100);
    });

    it('should initialize SP to 0xFFFE (post-boot state)', () => {
      const registers = new Registers();
      expect(registers.SP).toBe(0xFFFE);
    });

    it('should allow setting 16-bit PC and SP values', () => {
      const registers = new Registers();
      registers.PC = 0x8000;
      registers.SP = 0xC000;
      expect(registers.PC).toBe(0x8000);
      expect(registers.SP).toBe(0xC000);
    });
  });
});
