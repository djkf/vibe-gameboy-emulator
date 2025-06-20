import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryBus } from '../../src/memory/memory-bus';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Tetris ROM Integration', () => {
  let memory: MemoryBus;
  let tetrisRom: Uint8Array;

  beforeEach(() => {
    memory = new MemoryBus();
    
    // Load Tetris ROM for testing
    try {
      const romPath = join(process.cwd(), 'tetris.gb');
      const romBuffer = readFileSync(romPath);
      tetrisRom = new Uint8Array(romBuffer);
      memory.loadRom(tetrisRom);
    } catch (error) {
      throw new Error(`Could not load Tetris ROM: ${error}`);
    }
  });

  describe('ROM loading', () => {
    it('should load Tetris ROM successfully', () => {
      expect(tetrisRom.length).toBeGreaterThan(0);
      expect(tetrisRom.length).toBeLessThanOrEqual(32768); // Max 32KB for No MBC
    });

    it('should have correct ROM header signature', () => {
      // Game Boy ROM header starts at 0x0100 with entry point
      const entryPoint = memory.read16(0x0100);
      expect(entryPoint).toBeDefined();
      
      // Nintendo logo starts at 0x0104 (48 bytes)
      const logoStart = memory.read8(0x0104);
      expect(logoStart).toBe(0xCE); // First byte of Nintendo logo
    });

    it('should read game title from ROM header', () => {
      // Game title is at 0x0134-0x0143 (16 bytes)
      const titleBytes: number[] = [];
      for (let i = 0x0134; i < 0x0144; i++) {
        const byte = memory.read8(i);
        if (byte !== 0) titleBytes.push(byte);
      }
      
      const title = String.fromCharCode(...titleBytes);
      expect(title).toContain('TETRIS'); // Should contain "TETRIS"
    });

    it('should have correct cartridge type (No MBC)', () => {
      // Cartridge type is at 0x0147
      const cartridgeType = memory.read8(0x0147);
      expect(cartridgeType).toBe(0x00); // 0x00 = ROM ONLY (No MBC)
    });

    it('should have valid ROM size', () => {
      // ROM size is at 0x0148
      const romSize = memory.read8(0x0148);
      expect(romSize).toBe(0x00); // 0x00 = 32KB (2 banks of 16KB)
    });
  });

  describe('entry point', () => {
    it('should have entry point at 0x0100', () => {
      // Entry point should be a jump instruction or NOP
      const instruction = memory.read8(0x0100);
      // Common patterns: 0x00 (NOP), 0xC3 (JP), 0x18 (JR)
      expect([0x00, 0xC3, 0x18]).toContain(instruction);
    });

    it('should be able to read instructions from entry point', () => {
      // Should be able to read multiple bytes from entry point
      const byte1 = memory.read8(0x0100);
      const byte2 = memory.read8(0x0101);
      const byte3 = memory.read8(0x0102);
      
      expect(byte1).toBeDefined();
      expect(byte2).toBeDefined();
      expect(byte3).toBeDefined();
    });
  });
});
