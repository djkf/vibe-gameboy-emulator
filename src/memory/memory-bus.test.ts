import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryBus } from './memory-bus';

describe('MemoryBus', () => {
  let memory: MemoryBus;

  beforeEach(() => {
    memory = new MemoryBus();
  });

  describe('basic memory operations', () => {
    it('should read and write 8-bit values', () => {
      memory.write8(0x8000, 0xAB);
      expect(memory.read8(0x8000)).toBe(0xAB);
    });

    it('should read and write 16-bit values (little-endian)', () => {
      memory.write16(0x8000, 0x1234);
      expect(memory.read16(0x8000)).toBe(0x1234);
      // Check individual bytes
      expect(memory.read8(0x8000)).toBe(0x34); // low byte
      expect(memory.read8(0x8001)).toBe(0x12); // high byte
    });

    it('should wrap addresses to 16-bit range', () => {
      memory.write8(0x1C000, 0xFF); // Should wrap to 0xC000 (Work RAM)
      expect(memory.read8(0xC000)).toBe(0xFF);
    });
  });

  describe('memory regions', () => {
    it('should allow access to Work RAM (0x8000-0x9FFF)', () => {
      memory.write8(0x8000, 0x42);
      memory.write8(0x9FFF, 0x73);
      expect(memory.read8(0x8000)).toBe(0x42);
      expect(memory.read8(0x9FFF)).toBe(0x73);
    });

    it('should allow access to High RAM (0xFF80-0xFFFE)', () => {
      memory.write8(0xFF80, 0x11);
      memory.write8(0xFFFE, 0x22);
      expect(memory.read8(0xFF80)).toBe(0x11);
      expect(memory.read8(0xFFFE)).toBe(0x22);
    });

    it('should handle I/O register area (0xFF00-0xFF7F)', () => {
      memory.write8(0xFF00, 0x0F); // Joypad register
      memory.write8(0xFF40, 0x91); // LCD control register
      expect(memory.read8(0xFF00)).toBe(0x0F);
      expect(memory.read8(0xFF40)).toBe(0x91);
    });
  });

  describe('ROM region (read-only for now)', () => {
    it('should initialize ROM region to 0x00', () => {
      expect(memory.read8(0x0000)).toBe(0x00);
      expect(memory.read8(0x7FFF)).toBe(0x00);
    });

    it('should ignore writes to ROM region for now', () => {
      memory.write8(0x0000, 0xFF);
      expect(memory.read8(0x0000)).toBe(0x00); // Should remain 0x00
    });
  });
});
