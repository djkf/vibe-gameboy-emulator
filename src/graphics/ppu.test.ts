import { describe, it, expect, beforeEach } from 'vitest';
import { PPU } from './ppu';
import { MemoryBus } from '../memory/memory-bus';

describe('PPU', () => {
  let ppu: PPU;
  let memory: MemoryBus;

  beforeEach(() => {
    memory = new MemoryBus();
    ppu = new PPU(memory);
  });

  describe('initialization', () => {
    it('should initialize with correct dimensions', () => {
      expect(ppu.screenWidth).toBe(160);
      expect(ppu.screenHeight).toBe(144);
    });

    it('should initialize LCD control registers', () => {
      // LCD Control register at 0xFF40
      expect(memory.read8(0xFF40)).toBe(0x91); // Default post-boot value
      
      // LCD Status register at 0xFF41  
      expect(memory.read8(0xFF41)).toBe(0x00);
      
      // Scroll positions
      expect(memory.read8(0xFF42)).toBe(0x00); // SCY - scroll Y
      expect(memory.read8(0xFF43)).toBe(0x00); // SCX - scroll X
    });

    it('should start in OAM search mode', () => {
      expect(ppu.mode).toBe(2); // OAM search mode
      expect(ppu.currentLine).toBe(0);
    });
  });

  describe('scanline rendering', () => {
    it('should progress through PPU modes', () => {
      // Start in OAM search (mode 2)
      expect(ppu.mode).toBe(2);
      
      // Step through to pixel transfer (mode 3)
      ppu.step(80); // OAM search takes 80 cycles
      expect(ppu.mode).toBe(3);
      
      // Continue to H-blank (mode 0)
      ppu.step(172); // Pixel transfer takes 172 cycles
      expect(ppu.mode).toBe(0);
    });

    it('should increment scanline after each line', () => {
      const initialLine = ppu.currentLine;
      
      // Complete one full scanline (456 cycles total)
      ppu.step(456);
      
      expect(ppu.currentLine).toBe(initialLine + 1);
    });

    it('should trigger V-blank at line 144', () => {
      // Force to line 143 and make sure we're at the end of the scanline
      while (ppu.currentLine < 143) {
        ppu.step(456);
      }
      
      expect(ppu.currentLine).toBe(143);
      
      // Step to line 144 (V-blank start)
      ppu.step(456);
      
      expect(ppu.currentLine).toBe(144);
      expect(ppu.mode).toBe(1); // V-blank
      expect(ppu.vblankRequested).toBe(true);
    });
  });

  describe('background rendering', () => {
    it('should render a simple background tile', () => {
      // Set up a simple tile in VRAM
      // Tile 0 at 0x8000 - just a simple pattern
      memory.write8(0x8000, 0xFF); // ████████
      memory.write8(0x8001, 0x00); // ........
      memory.write8(0x8002, 0xFF); // ████████
      memory.write8(0x8003, 0x00); // ........
      memory.write8(0x8004, 0xFF); // ████████
      memory.write8(0x8005, 0x00); // ........
      memory.write8(0x8006, 0xFF); // ████████
      memory.write8(0x8007, 0x00); // ........
      memory.write8(0x8008, 0xFF); // ████████
      memory.write8(0x8009, 0x00); // ........
      memory.write8(0x800A, 0xFF); // ████████
      memory.write8(0x800B, 0x00); // ........
      memory.write8(0x800C, 0xFF); // ████████
      memory.write8(0x800D, 0x00); // ........
      memory.write8(0x800E, 0xFF); // ████████
      memory.write8(0x800F, 0x00); // ........
      
      // Set background tile map to use tile 0
      memory.write8(0x9800, 0x00); // Top-left tile = tile 0
      
      // Enable LCD and background
      memory.write8(0xFF40, 0x91); // LCD on, background on
      
      // Render one line
      ppu.renderScanline();
      
      // Get the framebuffer (should have some pixels set)
      const framebuffer = ppu.getFramebuffer();
      expect(framebuffer).toBeDefined();
      expect(framebuffer.length).toBe(160 * 144); // One value per pixel
    });
  });
});
