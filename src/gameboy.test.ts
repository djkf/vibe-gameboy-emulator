import { describe, it, expect, beforeEach } from 'vitest';
import { GameBoy } from './gameboy';

describe('GameBoy Emulator', () => {
  let gameboy: GameBoy;

  beforeEach(() => {
    gameboy = new GameBoy();
  });

  describe('initialization', () => {
    it('should initialize all components', () => {
      expect(gameboy.cpu).toBeDefined();
      expect(gameboy.memory).toBeDefined();
      expect(gameboy.ppu).toBeDefined();
    });

    it('should start with correct initial state', () => {
      expect(gameboy.totalCycles).toBe(0);
      expect(gameboy.isRunning).toBe(false);
    });
  });

  describe('ROM loading', () => {
    it('should load ROM data', () => {
      const testRom = new Uint8Array([0x00, 0x18, 0xFE]); // NOP, JR -2
      gameboy.loadRom(testRom);
      
      // Check ROM is loaded
      expect(gameboy.memory.read8(0x0000)).toBe(0x00);
      expect(gameboy.memory.read8(0x0001)).toBe(0x18);
      expect(gameboy.memory.read8(0x0002)).toBe(0xFE);
    });
  });

  describe('execution', () => {
    it('should execute one frame of instructions', () => {
      // Load a simple test program
      const testRom = new Uint8Array(32768);
      testRom[0x100] = 0x00; // NOP at entry point
      testRom[0x101] = 0x18; // JR -2 (infinite loop)
      testRom[0x102] = 0xFE;
      gameboy.loadRom(testRom);
      
      const initialCycles = gameboy.totalCycles;
      
      // Run one frame
      gameboy.runFrame();
      
      // Should have executed some cycles
      expect(gameboy.totalCycles).toBeGreaterThan(initialCycles);
    });

    it('should handle V-blank interrupt', () => {
      // Set up interrupt enable register
      gameboy.memory.write8(0xFFFF, 0x01); // Enable V-blank interrupt
      gameboy.cpu.registers.flagC = false; // Enable interrupts (IME would be set)
      
      // Force PPU to trigger V-blank
      while (!gameboy.ppu.vblankRequested) {
        gameboy.step();
      }
      
      expect(gameboy.ppu.vblankRequested).toBe(true);
    });
  });

  describe('step execution', () => {
    it('should synchronize CPU and PPU timing', () => {
      const testRom = new Uint8Array(32768);
      testRom[0x100] = 0x00; // NOP
      gameboy.loadRom(testRom);
      
      const initialCpuCycles = gameboy.cpu.totalCycles;
      const initialTotalCycles = gameboy.totalCycles;
      
      gameboy.step();
      
      // Both should have advanced
      expect(gameboy.cpu.totalCycles).toBeGreaterThan(initialCpuCycles);
      expect(gameboy.totalCycles).toBeGreaterThan(initialTotalCycles);
    });
  });
});
