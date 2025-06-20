#!/usr/bin/env node
/**
 * ROM Analyzer - Extracts CPU instructions used in a Game Boy ROM
 */
import { readFileSync } from 'fs';

interface InstructionInfo {
  opcode: number;
  mnemonic: string;
  description: string;
  operands: string;
  length: number;
  cycles: number;
}

// Game Boy CPU instruction set reference
const INSTRUCTION_SET: Record<number, InstructionInfo> = {
  0x00: { opcode: 0x00, mnemonic: 'NOP', description: 'No operation', operands: '', length: 1, cycles: 4 },
  0x01: { opcode: 0x01, mnemonic: 'LD', description: 'Load 16-bit immediate into BC', operands: 'BC,nn', length: 3, cycles: 12 },
  0x02: { opcode: 0x02, mnemonic: 'LD', description: 'Load A into (BC)', operands: '(BC),A', length: 1, cycles: 8 },
  0x03: { opcode: 0x03, mnemonic: 'INC', description: 'Increment BC', operands: 'BC', length: 1, cycles: 8 },
  0x04: { opcode: 0x04, mnemonic: 'INC', description: 'Increment B', operands: 'B', length: 1, cycles: 4 },
  0x05: { opcode: 0x05, mnemonic: 'DEC', description: 'Decrement B', operands: 'B', length: 1, cycles: 4 },
  0x06: { opcode: 0x06, mnemonic: 'LD', description: 'Load 8-bit immediate into B', operands: 'B,n', length: 2, cycles: 8 },
  0x07: { opcode: 0x07, mnemonic: 'RLCA', description: 'Rotate A left circular', operands: '', length: 1, cycles: 4 },
  0x08: { opcode: 0x08, mnemonic: 'LD', description: 'Load SP into (nn)', operands: '(nn),SP', length: 3, cycles: 20 },
  0x09: { opcode: 0x09, mnemonic: 'ADD', description: 'Add BC to HL', operands: 'HL,BC', length: 1, cycles: 8 },
  0x0A: { opcode: 0x0A, mnemonic: 'LD', description: 'Load (BC) into A', operands: 'A,(BC)', length: 1, cycles: 8 },
  0x0B: { opcode: 0x0B, mnemonic: 'DEC', description: 'Decrement BC', operands: 'BC', length: 1, cycles: 8 },
  0x0C: { opcode: 0x0C, mnemonic: 'INC', description: 'Increment C', operands: 'C', length: 1, cycles: 4 },
  0x0D: { opcode: 0x0D, mnemonic: 'DEC', description: 'Decrement C', operands: 'C', length: 1, cycles: 4 },
  0x0E: { opcode: 0x0E, mnemonic: 'LD', description: 'Load 8-bit immediate into C', operands: 'C,n', length: 2, cycles: 8 },
  0x0F: { opcode: 0x0F, mnemonic: 'RRCA', description: 'Rotate A right circular', operands: '', length: 1, cycles: 4 },
  
  0x10: { opcode: 0x10, mnemonic: 'STOP', description: 'Stop processor', operands: '', length: 1, cycles: 4 },
  0x11: { opcode: 0x11, mnemonic: 'LD', description: 'Load 16-bit immediate into DE', operands: 'DE,nn', length: 3, cycles: 12 },
  0x12: { opcode: 0x12, mnemonic: 'LD', description: 'Load A into (DE)', operands: '(DE),A', length: 1, cycles: 8 },
  0x13: { opcode: 0x13, mnemonic: 'INC', description: 'Increment DE', operands: 'DE', length: 1, cycles: 8 },
  0x14: { opcode: 0x14, mnemonic: 'INC', description: 'Increment D', operands: 'D', length: 1, cycles: 4 },
  0x15: { opcode: 0x15, mnemonic: 'DEC', description: 'Decrement D', operands: 'D', length: 1, cycles: 4 },
  0x16: { opcode: 0x16, mnemonic: 'LD', description: 'Load 8-bit immediate into D', operands: 'D,n', length: 2, cycles: 8 },
  0x17: { opcode: 0x17, mnemonic: 'RLA', description: 'Rotate A left through carry', operands: '', length: 1, cycles: 4 },
  0x18: { opcode: 0x18, mnemonic: 'JR', description: 'Jump relative', operands: 'n', length: 2, cycles: 12 },
  0x19: { opcode: 0x19, mnemonic: 'ADD', description: 'Add DE to HL', operands: 'HL,DE', length: 1, cycles: 8 },
  0x1A: { opcode: 0x1A, mnemonic: 'LD', description: 'Load (DE) into A', operands: 'A,(DE)', length: 1, cycles: 8 },
  0x1B: { opcode: 0x1B, mnemonic: 'DEC', description: 'Decrement DE', operands: 'DE', length: 1, cycles: 8 },
  0x1C: { opcode: 0x1C, mnemonic: 'INC', description: 'Increment E', operands: 'E', length: 1, cycles: 4 },
  0x1D: { opcode: 0x1D, mnemonic: 'DEC', description: 'Decrement E', operands: 'E', length: 1, cycles: 4 },
  0x1E: { opcode: 0x1E, mnemonic: 'LD', description: 'Load 8-bit immediate into E', operands: 'E,n', length: 2, cycles: 8 },
  0x1F: { opcode: 0x1F, mnemonic: 'RRA', description: 'Rotate A right through carry', operands: '', length: 1, cycles: 4 },
  
  0x20: { opcode: 0x20, mnemonic: 'JR', description: 'Jump relative if not zero', operands: 'NZ,n', length: 2, cycles: 8 },
  0x21: { opcode: 0x21, mnemonic: 'LD', description: 'Load 16-bit immediate into HL', operands: 'HL,nn', length: 3, cycles: 12 },
  0x22: { opcode: 0x22, mnemonic: 'LD', description: 'Load A into (HL+)', operands: '(HL+),A', length: 1, cycles: 8 },
  0x23: { opcode: 0x23, mnemonic: 'INC', description: 'Increment HL', operands: 'HL', length: 1, cycles: 8 },
  0x24: { opcode: 0x24, mnemonic: 'INC', description: 'Increment H', operands: 'H', length: 1, cycles: 4 },
  0x25: { opcode: 0x25, mnemonic: 'DEC', description: 'Decrement H', operands: 'H', length: 1, cycles: 4 },
  0x26: { opcode: 0x26, mnemonic: 'LD', description: 'Load 8-bit immediate into H', operands: 'H,n', length: 2, cycles: 8 },
  0x27: { opcode: 0x27, mnemonic: 'DAA', description: 'Decimal adjust A', operands: '', length: 1, cycles: 4 },
  0x28: { opcode: 0x28, mnemonic: 'JR', description: 'Jump relative if zero', operands: 'Z,n', length: 2, cycles: 8 },
  0x29: { opcode: 0x29, mnemonic: 'ADD', description: 'Add HL to HL', operands: 'HL,HL', length: 1, cycles: 8 },
  0x2A: { opcode: 0x2A, mnemonic: 'LD', description: 'Load (HL+) into A', operands: 'A,(HL+)', length: 1, cycles: 8 },
  0x2B: { opcode: 0x2B, mnemonic: 'DEC', description: 'Decrement HL', operands: 'HL', length: 1, cycles: 8 },
  0x2C: { opcode: 0x2C, mnemonic: 'INC', description: 'Increment L', operands: 'L', length: 1, cycles: 4 },
  0x2D: { opcode: 0x2D, mnemonic: 'DEC', description: 'Decrement L', operands: 'L', length: 1, cycles: 4 },
  0x2E: { opcode: 0x2E, mnemonic: 'LD', description: 'Load 8-bit immediate into L', operands: 'L,n', length: 2, cycles: 8 },
  0x2F: { opcode: 0x2F, mnemonic: 'CPL', description: 'Complement A', operands: '', length: 1, cycles: 4 },
  
  0x30: { opcode: 0x30, mnemonic: 'JR', description: 'Jump relative if no carry', operands: 'NC,n', length: 2, cycles: 8 },
  0x31: { opcode: 0x31, mnemonic: 'LD', description: 'Load 16-bit immediate into SP', operands: 'SP,nn', length: 3, cycles: 12 },
  0x32: { opcode: 0x32, mnemonic: 'LD', description: 'Load A into (HL-)', operands: '(HL-),A', length: 1, cycles: 8 },
  0x33: { opcode: 0x33, mnemonic: 'INC', description: 'Increment SP', operands: 'SP', length: 1, cycles: 8 },
  0x34: { opcode: 0x34, mnemonic: 'INC', description: 'Increment (HL)', operands: '(HL)', length: 1, cycles: 12 },
  0x35: { opcode: 0x35, mnemonic: 'DEC', description: 'Decrement (HL)', operands: '(HL)', length: 1, cycles: 12 },
  0x36: { opcode: 0x36, mnemonic: 'LD', description: 'Load 8-bit immediate into (HL)', operands: '(HL),n', length: 2, cycles: 12 },
  0x37: { opcode: 0x37, mnemonic: 'SCF', description: 'Set carry flag', operands: '', length: 1, cycles: 4 },
  0x38: { opcode: 0x38, mnemonic: 'JR', description: 'Jump relative if carry', operands: 'C,n', length: 2, cycles: 8 },
  0x39: { opcode: 0x39, mnemonic: 'ADD', description: 'Add SP to HL', operands: 'HL,SP', length: 1, cycles: 8 },
  0x3A: { opcode: 0x3A, mnemonic: 'LD', description: 'Load (HL-) into A', operands: 'A,(HL-)', length: 1, cycles: 8 },
  0x3B: { opcode: 0x3B, mnemonic: 'DEC', description: 'Decrement SP', operands: 'SP', length: 1, cycles: 8 },
  0x3C: { opcode: 0x3C, mnemonic: 'INC', description: 'Increment A', operands: 'A', length: 1, cycles: 4 },
  0x3D: { opcode: 0x3D, mnemonic: 'DEC', description: 'Decrement A', operands: 'A', length: 1, cycles: 4 },
  0x3E: { opcode: 0x3E, mnemonic: 'LD', description: 'Load 8-bit immediate into A', operands: 'A,n', length: 2, cycles: 8 },
  0x3F: { opcode: 0x3F, mnemonic: 'CCF', description: 'Complement carry flag', operands: '', length: 1, cycles: 4 },
  
  // 0x40-0x7F: LD r,r' (register to register loads)
  0x40: { opcode: 0x40, mnemonic: 'LD', description: 'Load B into B', operands: 'B,B', length: 1, cycles: 4 },
  0x41: { opcode: 0x41, mnemonic: 'LD', description: 'Load C into B', operands: 'B,C', length: 1, cycles: 4 },
  0x42: { opcode: 0x42, mnemonic: 'LD', description: 'Load D into B', operands: 'B,D', length: 1, cycles: 4 },
  0x43: { opcode: 0x43, mnemonic: 'LD', description: 'Load E into B', operands: 'B,E', length: 1, cycles: 4 },
  0x44: { opcode: 0x44, mnemonic: 'LD', description: 'Load H into B', operands: 'B,H', length: 1, cycles: 4 },
  0x45: { opcode: 0x45, mnemonic: 'LD', description: 'Load L into B', operands: 'B,L', length: 1, cycles: 4 },
  0x46: { opcode: 0x46, mnemonic: 'LD', description: 'Load (HL) into B', operands: 'B,(HL)', length: 1, cycles: 8 },
  0x47: { opcode: 0x47, mnemonic: 'LD', description: 'Load A into B', operands: 'B,A', length: 1, cycles: 4 },
  0x48: { opcode: 0x48, mnemonic: 'LD', description: 'Load B into C', operands: 'C,B', length: 1, cycles: 4 },
  0x49: { opcode: 0x49, mnemonic: 'LD', description: 'Load C into C', operands: 'C,C', length: 1, cycles: 4 },
  0x4A: { opcode: 0x4A, mnemonic: 'LD', description: 'Load D into C', operands: 'C,D', length: 1, cycles: 4 },
  0x4B: { opcode: 0x4B, mnemonic: 'LD', description: 'Load E into C', operands: 'C,E', length: 1, cycles: 4 },
  0x4C: { opcode: 0x4C, mnemonic: 'LD', description: 'Load H into C', operands: 'C,H', length: 1, cycles: 4 },
  0x4D: { opcode: 0x4D, mnemonic: 'LD', description: 'Load L into C', operands: 'C,L', length: 1, cycles: 4 },
  0x4E: { opcode: 0x4E, mnemonic: 'LD', description: 'Load (HL) into C', operands: 'C,(HL)', length: 1, cycles: 8 },
  0x4F: { opcode: 0x4F, mnemonic: 'LD', description: 'Load A into C', operands: 'C,A', length: 1, cycles: 4 },
  0x50: { opcode: 0x50, mnemonic: 'LD', description: 'Load B into D', operands: 'D,B', length: 1, cycles: 4 },
  0x51: { opcode: 0x51, mnemonic: 'LD', description: 'Load C into D', operands: 'D,C', length: 1, cycles: 4 },
  0x52: { opcode: 0x52, mnemonic: 'LD', description: 'Load D into D', operands: 'D,D', length: 1, cycles: 4 },
  0x53: { opcode: 0x53, mnemonic: 'LD', description: 'Load E into D', operands: 'D,E', length: 1, cycles: 4 },
  0x54: { opcode: 0x54, mnemonic: 'LD', description: 'Load H into D', operands: 'D,H', length: 1, cycles: 4 },
  0x55: { opcode: 0x55, mnemonic: 'LD', description: 'Load L into D', operands: 'D,L', length: 1, cycles: 4 },
  0x56: { opcode: 0x56, mnemonic: 'LD', description: 'Load (HL) into D', operands: 'D,(HL)', length: 1, cycles: 8 },
  0x57: { opcode: 0x57, mnemonic: 'LD', description: 'Load A into D', operands: 'D,A', length: 1, cycles: 4 },
  0x58: { opcode: 0x58, mnemonic: 'LD', description: 'Load B into E', operands: 'E,B', length: 1, cycles: 4 },
  0x59: { opcode: 0x59, mnemonic: 'LD', description: 'Load C into E', operands: 'E,C', length: 1, cycles: 4 },
  0x5A: { opcode: 0x5A, mnemonic: 'LD', description: 'Load D into E', operands: 'E,D', length: 1, cycles: 4 },
  0x5B: { opcode: 0x5B, mnemonic: 'LD', description: 'Load E into E', operands: 'E,E', length: 1, cycles: 4 },
  0x5C: { opcode: 0x5C, mnemonic: 'LD', description: 'Load H into E', operands: 'E,H', length: 1, cycles: 4 },
  0x5D: { opcode: 0x5D, mnemonic: 'LD', description: 'Load L into E', operands: 'E,L', length: 1, cycles: 4 },
  0x5E: { opcode: 0x5E, mnemonic: 'LD', description: 'Load (HL) into E', operands: 'E,(HL)', length: 1, cycles: 8 },
  0x5F: { opcode: 0x5F, mnemonic: 'LD', description: 'Load A into E', operands: 'E,A', length: 1, cycles: 4 },
  0x60: { opcode: 0x60, mnemonic: 'LD', description: 'Load B into H', operands: 'H,B', length: 1, cycles: 4 },
  0x61: { opcode: 0x61, mnemonic: 'LD', description: 'Load C into H', operands: 'H,C', length: 1, cycles: 4 },
  0x62: { opcode: 0x62, mnemonic: 'LD', description: 'Load D into H', operands: 'H,D', length: 1, cycles: 4 },
  0x63: { opcode: 0x63, mnemonic: 'LD', description: 'Load E into H', operands: 'H,E', length: 1, cycles: 4 },
  0x64: { opcode: 0x64, mnemonic: 'LD', description: 'Load H into H', operands: 'H,H', length: 1, cycles: 4 },
  0x65: { opcode: 0x65, mnemonic: 'LD', description: 'Load L into H', operands: 'H,L', length: 1, cycles: 4 },
  0x66: { opcode: 0x66, mnemonic: 'LD', description: 'Load (HL) into H', operands: 'H,(HL)', length: 1, cycles: 8 },
  0x67: { opcode: 0x67, mnemonic: 'LD', description: 'Load A into H', operands: 'H,A', length: 1, cycles: 4 },
  0x68: { opcode: 0x68, mnemonic: 'LD', description: 'Load B into L', operands: 'L,B', length: 1, cycles: 4 },
  0x69: { opcode: 0x69, mnemonic: 'LD', description: 'Load C into L', operands: 'L,C', length: 1, cycles: 4 },
  0x6A: { opcode: 0x6A, mnemonic: 'LD', description: 'Load D into L', operands: 'L,D', length: 1, cycles: 4 },
  0x6B: { opcode: 0x6B, mnemonic: 'LD', description: 'Load E into L', operands: 'L,E', length: 1, cycles: 4 },
  0x6C: { opcode: 0x6C, mnemonic: 'LD', description: 'Load H into L', operands: 'L,H', length: 1, cycles: 4 },
  0x6D: { opcode: 0x6D, mnemonic: 'LD', description: 'Load L into L', operands: 'L,L', length: 1, cycles: 4 },
  0x6E: { opcode: 0x6E, mnemonic: 'LD', description: 'Load (HL) into L', operands: 'L,(HL)', length: 1, cycles: 8 },
  0x6F: { opcode: 0x6F, mnemonic: 'LD', description: 'Load A into L', operands: 'L,A', length: 1, cycles: 4 },
  0x70: { opcode: 0x70, mnemonic: 'LD', description: 'Load B into (HL)', operands: '(HL),B', length: 1, cycles: 8 },
  0x71: { opcode: 0x71, mnemonic: 'LD', description: 'Load C into (HL)', operands: '(HL),C', length: 1, cycles: 8 },
  0x72: { opcode: 0x72, mnemonic: 'LD', description: 'Load D into (HL)', operands: '(HL),D', length: 1, cycles: 8 },
  0x73: { opcode: 0x73, mnemonic: 'LD', description: 'Load E into (HL)', operands: '(HL),E', length: 1, cycles: 8 },
  0x74: { opcode: 0x74, mnemonic: 'LD', description: 'Load H into (HL)', operands: '(HL),H', length: 1, cycles: 8 },
  0x75: { opcode: 0x75, mnemonic: 'LD', description: 'Load L into (HL)', operands: '(HL),L', length: 1, cycles: 8 },
  0x76: { opcode: 0x76, mnemonic: 'HALT', description: 'Halt processor', operands: '', length: 1, cycles: 4 },
  0x77: { opcode: 0x77, mnemonic: 'LD', description: 'Load A into (HL)', operands: '(HL),A', length: 1, cycles: 8 },
  0x78: { opcode: 0x78, mnemonic: 'LD', description: 'Load B into A', operands: 'A,B', length: 1, cycles: 4 },
  0x79: { opcode: 0x79, mnemonic: 'LD', description: 'Load C into A', operands: 'A,C', length: 1, cycles: 4 },
  0x7A: { opcode: 0x7A, mnemonic: 'LD', description: 'Load D into A', operands: 'A,D', length: 1, cycles: 4 },
  0x7B: { opcode: 0x7B, mnemonic: 'LD', description: 'Load E into A', operands: 'A,E', length: 1, cycles: 4 },
  0x7C: { opcode: 0x7C, mnemonic: 'LD', description: 'Load H into A', operands: 'A,H', length: 1, cycles: 4 },
  0x7D: { opcode: 0x7D, mnemonic: 'LD', description: 'Load L into A', operands: 'A,L', length: 1, cycles: 4 },
  0x7E: { opcode: 0x7E, mnemonic: 'LD', description: 'Load (HL) into A', operands: 'A,(HL)', length: 1, cycles: 8 },
  0x7F: { opcode: 0x7F, mnemonic: 'LD', description: 'Load A into A', operands: 'A,A', length: 1, cycles: 4 },
  
  // Arithmetic operations 0x80-0xBF
  0x80: { opcode: 0x80, mnemonic: 'ADD', description: 'Add B to A', operands: 'A,B', length: 1, cycles: 4 },
  0x81: { opcode: 0x81, mnemonic: 'ADD', description: 'Add C to A', operands: 'A,C', length: 1, cycles: 4 },
  0x82: { opcode: 0x82, mnemonic: 'ADD', description: 'Add D to A', operands: 'A,D', length: 1, cycles: 4 },
  0x83: { opcode: 0x83, mnemonic: 'ADD', description: 'Add E to A', operands: 'A,E', length: 1, cycles: 4 },
  0x84: { opcode: 0x84, mnemonic: 'ADD', description: 'Add H to A', operands: 'A,H', length: 1, cycles: 4 },
  0x85: { opcode: 0x85, mnemonic: 'ADD', description: 'Add L to A', operands: 'A,L', length: 1, cycles: 4 },
  0x86: { opcode: 0x86, mnemonic: 'ADD', description: 'Add (HL) to A', operands: 'A,(HL)', length: 1, cycles: 8 },
  0x87: { opcode: 0x87, mnemonic: 'ADD', description: 'Add A to A', operands: 'A,A', length: 1, cycles: 4 },
  0x88: { opcode: 0x88, mnemonic: 'ADC', description: 'Add B to A with carry', operands: 'A,B', length: 1, cycles: 4 },
  0x89: { opcode: 0x89, mnemonic: 'ADC', description: 'Add C to A with carry', operands: 'A,C', length: 1, cycles: 4 },
  0x8A: { opcode: 0x8A, mnemonic: 'ADC', description: 'Add D to A with carry', operands: 'A,D', length: 1, cycles: 4 },
  0x8B: { opcode: 0x8B, mnemonic: 'ADC', description: 'Add E to A with carry', operands: 'A,E', length: 1, cycles: 4 },
  0x8C: { opcode: 0x8C, mnemonic: 'ADC', description: 'Add H to A with carry', operands: 'A,H', length: 1, cycles: 4 },
  0x8D: { opcode: 0x8D, mnemonic: 'ADC', description: 'Add L to A with carry', operands: 'A,L', length: 1, cycles: 4 },
  0x8E: { opcode: 0x8E, mnemonic: 'ADC', description: 'Add (HL) to A with carry', operands: 'A,(HL)', length: 1, cycles: 8 },
  0x8F: { opcode: 0x8F, mnemonic: 'ADC', description: 'Add A to A with carry', operands: 'A,A', length: 1, cycles: 4 },
  0x90: { opcode: 0x90, mnemonic: 'SUB', description: 'Subtract B from A', operands: 'B', length: 1, cycles: 4 },
  0x91: { opcode: 0x91, mnemonic: 'SUB', description: 'Subtract C from A', operands: 'C', length: 1, cycles: 4 },
  0x92: { opcode: 0x92, mnemonic: 'SUB', description: 'Subtract D from A', operands: 'D', length: 1, cycles: 4 },
  0x93: { opcode: 0x93, mnemonic: 'SUB', description: 'Subtract E from A', operands: 'E', length: 1, cycles: 4 },
  0x94: { opcode: 0x94, mnemonic: 'SUB', description: 'Subtract H from A', operands: 'H', length: 1, cycles: 4 },
  0x95: { opcode: 0x95, mnemonic: 'SUB', description: 'Subtract L from A', operands: 'L', length: 1, cycles: 4 },
  0x96: { opcode: 0x96, mnemonic: 'SUB', description: 'Subtract (HL) from A', operands: '(HL)', length: 1, cycles: 8 },
  0x97: { opcode: 0x97, mnemonic: 'SUB', description: 'Subtract A from A', operands: 'A', length: 1, cycles: 4 },
  0x98: { opcode: 0x98, mnemonic: 'SBC', description: 'Subtract B from A with carry', operands: 'A,B', length: 1, cycles: 4 },
  0x99: { opcode: 0x99, mnemonic: 'SBC', description: 'Subtract C from A with carry', operands: 'A,C', length: 1, cycles: 4 },
  0x9A: { opcode: 0x9A, mnemonic: 'SBC', description: 'Subtract D from A with carry', operands: 'A,D', length: 1, cycles: 4 },
  0x9B: { opcode: 0x9B, mnemonic: 'SBC', description: 'Subtract E from A with carry', operands: 'A,E', length: 1, cycles: 4 },
  0x9C: { opcode: 0x9C, mnemonic: 'SBC', description: 'Subtract H from A with carry', operands: 'A,H', length: 1, cycles: 4 },
  0x9D: { opcode: 0x9D, mnemonic: 'SBC', description: 'Subtract L from A with carry', operands: 'A,L', length: 1, cycles: 4 },
  0x9E: { opcode: 0x9E, mnemonic: 'SBC', description: 'Subtract (HL) from A with carry', operands: 'A,(HL)', length: 1, cycles: 8 },
  0x9F: { opcode: 0x9F, mnemonic: 'SBC', description: 'Subtract A from A with carry', operands: 'A,A', length: 1, cycles: 4 },
  0xA0: { opcode: 0xA0, mnemonic: 'AND', description: 'AND B with A', operands: 'B', length: 1, cycles: 4 },
  0xA1: { opcode: 0xA1, mnemonic: 'AND', description: 'AND C with A', operands: 'C', length: 1, cycles: 4 },
  0xA2: { opcode: 0xA2, mnemonic: 'AND', description: 'AND D with A', operands: 'D', length: 1, cycles: 4 },
  0xA3: { opcode: 0xA3, mnemonic: 'AND', description: 'AND E with A', operands: 'E', length: 1, cycles: 4 },
  0xA4: { opcode: 0xA4, mnemonic: 'AND', description: 'AND H with A', operands: 'H', length: 1, cycles: 4 },
  0xA5: { opcode: 0xA5, mnemonic: 'AND', description: 'AND L with A', operands: 'L', length: 1, cycles: 4 },
  0xA6: { opcode: 0xA6, mnemonic: 'AND', description: 'AND (HL) with A', operands: '(HL)', length: 1, cycles: 8 },
  0xA7: { opcode: 0xA7, mnemonic: 'AND', description: 'AND A with A', operands: 'A', length: 1, cycles: 4 },
  0xA8: { opcode: 0xA8, mnemonic: 'XOR', description: 'XOR B with A', operands: 'B', length: 1, cycles: 4 },
  0xA9: { opcode: 0xA9, mnemonic: 'XOR', description: 'XOR C with A', operands: 'C', length: 1, cycles: 4 },
  0xAA: { opcode: 0xAA, mnemonic: 'XOR', description: 'XOR D with A', operands: 'D', length: 1, cycles: 4 },
  0xAB: { opcode: 0xAB, mnemonic: 'XOR', description: 'XOR E with A', operands: 'E', length: 1, cycles: 4 },
  0xAC: { opcode: 0xAC, mnemonic: 'XOR', description: 'XOR H with A', operands: 'H', length: 1, cycles: 4 },
  0xAD: { opcode: 0xAD, mnemonic: 'XOR', description: 'XOR L with A', operands: 'L', length: 1, cycles: 4 },
  0xAE: { opcode: 0xAE, mnemonic: 'XOR', description: 'XOR (HL) with A', operands: '(HL)', length: 1, cycles: 8 },
  0xAF: { opcode: 0xAF, mnemonic: 'XOR', description: 'XOR A with A', operands: 'A', length: 1, cycles: 4 },
  0xB0: { opcode: 0xB0, mnemonic: 'OR', description: 'OR B with A', operands: 'B', length: 1, cycles: 4 },
  0xB1: { opcode: 0xB1, mnemonic: 'OR', description: 'OR C with A', operands: 'C', length: 1, cycles: 4 },
  0xB2: { opcode: 0xB2, mnemonic: 'OR', description: 'OR D with A', operands: 'D', length: 1, cycles: 4 },
  0xB3: { opcode: 0xB3, mnemonic: 'OR', description: 'OR E with A', operands: 'E', length: 1, cycles: 4 },
  0xB4: { opcode: 0xB4, mnemonic: 'OR', description: 'OR H with A', operands: 'H', length: 1, cycles: 4 },
  0xB5: { opcode: 0xB5, mnemonic: 'OR', description: 'OR L with A', operands: 'L', length: 1, cycles: 4 },
  0xB6: { opcode: 0xB6, mnemonic: 'OR', description: 'OR (HL) with A', operands: '(HL)', length: 1, cycles: 8 },
  0xB7: { opcode: 0xB7, mnemonic: 'OR', description: 'OR A with A', operands: 'A', length: 1, cycles: 4 },
  0xB8: { opcode: 0xB8, mnemonic: 'CP', description: 'Compare B with A', operands: 'B', length: 1, cycles: 4 },
  0xB9: { opcode: 0xB9, mnemonic: 'CP', description: 'Compare C with A', operands: 'C', length: 1, cycles: 4 },
  0xBA: { opcode: 0xBA, mnemonic: 'CP', description: 'Compare D with A', operands: 'D', length: 1, cycles: 4 },
  0xBB: { opcode: 0xBB, mnemonic: 'CP', description: 'Compare E with A', operands: 'E', length: 1, cycles: 4 },
  0xBC: { opcode: 0xBC, mnemonic: 'CP', description: 'Compare H with A', operands: 'H', length: 1, cycles: 4 },
  0xBD: { opcode: 0xBD, mnemonic: 'CP', description: 'Compare L with A', operands: 'L', length: 1, cycles: 4 },
  0xBE: { opcode: 0xBE, mnemonic: 'CP', description: 'Compare (HL) with A', operands: '(HL)', length: 1, cycles: 8 },
  0xBF: { opcode: 0xBF, mnemonic: 'CP', description: 'Compare A with A', operands: 'A', length: 1, cycles: 4 },
  
  // Conditional operations 0xC0-0xFF
  0xC0: { opcode: 0xC0, mnemonic: 'RET', description: 'Return if not zero', operands: 'NZ', length: 1, cycles: 8 },
  0xC1: { opcode: 0xC1, mnemonic: 'POP', description: 'Pop from stack to BC', operands: 'BC', length: 1, cycles: 12 },
  0xC2: { opcode: 0xC2, mnemonic: 'JP', description: 'Jump if not zero', operands: 'NZ,nn', length: 3, cycles: 12 },
  0xC3: { opcode: 0xC3, mnemonic: 'JP', description: 'Jump absolute', operands: 'nn', length: 3, cycles: 16 },
  0xC4: { opcode: 0xC4, mnemonic: 'CALL', description: 'Call if not zero', operands: 'NZ,nn', length: 3, cycles: 12 },
  0xC5: { opcode: 0xC5, mnemonic: 'PUSH', description: 'Push BC to stack', operands: 'BC', length: 1, cycles: 16 },
  0xC6: { opcode: 0xC6, mnemonic: 'ADD', description: 'Add immediate to A', operands: 'A,n', length: 2, cycles: 8 },
  0xC7: { opcode: 0xC7, mnemonic: 'RST', description: 'Restart at 0x00', operands: '00H', length: 1, cycles: 16 },
  0xC8: { opcode: 0xC8, mnemonic: 'RET', description: 'Return if zero', operands: 'Z', length: 1, cycles: 8 },
  0xC9: { opcode: 0xC9, mnemonic: 'RET', description: 'Return', operands: '', length: 1, cycles: 16 },
  0xCA: { opcode: 0xCA, mnemonic: 'JP', description: 'Jump if zero', operands: 'Z,nn', length: 3, cycles: 12 },
  0xCB: { opcode: 0xCB, mnemonic: 'PREFIX', description: 'CB prefix for bit operations', operands: '', length: 1, cycles: 4 },
  0xCC: { opcode: 0xCC, mnemonic: 'CALL', description: 'Call if zero', operands: 'Z,nn', length: 3, cycles: 12 },
  0xCD: { opcode: 0xCD, mnemonic: 'CALL', description: 'Call absolute', operands: 'nn', length: 3, cycles: 24 },
  0xCE: { opcode: 0xCE, mnemonic: 'ADC', description: 'Add immediate to A with carry', operands: 'A,n', length: 2, cycles: 8 },
  0xCF: { opcode: 0xCF, mnemonic: 'RST', description: 'Restart at 0x08', operands: '08H', length: 1, cycles: 16 },
  
  0xD0: { opcode: 0xD0, mnemonic: 'RET', description: 'Return if no carry', operands: 'NC', length: 1, cycles: 8 },
  0xD1: { opcode: 0xD1, mnemonic: 'POP', description: 'Pop from stack to DE', operands: 'DE', length: 1, cycles: 12 },
  0xD2: { opcode: 0xD2, mnemonic: 'JP', description: 'Jump if no carry', operands: 'NC,nn', length: 3, cycles: 12 },
  0xD3: { opcode: 0xD3, mnemonic: 'UNUSED', description: 'Unused opcode', operands: '', length: 1, cycles: 4 },
  0xD4: { opcode: 0xD4, mnemonic: 'CALL', description: 'Call if no carry', operands: 'NC,nn', length: 3, cycles: 12 },
  0xD5: { opcode: 0xD5, mnemonic: 'PUSH', description: 'Push DE to stack', operands: 'DE', length: 1, cycles: 16 },
  0xD6: { opcode: 0xD6, mnemonic: 'SUB', description: 'Subtract immediate from A', operands: 'n', length: 2, cycles: 8 },
  0xD7: { opcode: 0xD7, mnemonic: 'RST', description: 'Restart at 0x10', operands: '10H', length: 1, cycles: 16 },
  0xD8: { opcode: 0xD8, mnemonic: 'RET', description: 'Return if carry', operands: 'C', length: 1, cycles: 8 },
  0xD9: { opcode: 0xD9, mnemonic: 'RETI', description: 'Return from interrupt', operands: '', length: 1, cycles: 16 },
  0xDA: { opcode: 0xDA, mnemonic: 'JP', description: 'Jump if carry', operands: 'C,nn', length: 3, cycles: 12 },
  0xDB: { opcode: 0xDB, mnemonic: 'UNUSED', description: 'Unused opcode', operands: '', length: 1, cycles: 4 },
  0xDC: { opcode: 0xDC, mnemonic: 'CALL', description: 'Call if carry', operands: 'C,nn', length: 3, cycles: 12 },
  0xDD: { opcode: 0xDD, mnemonic: 'UNUSED', description: 'Unused opcode', operands: '', length: 1, cycles: 4 },
  0xDE: { opcode: 0xDE, mnemonic: 'SBC', description: 'Subtract immediate from A with carry', operands: 'A,n', length: 2, cycles: 8 },
  0xDF: { opcode: 0xDF, mnemonic: 'RST', description: 'Restart at 0x18', operands: '18H', length: 1, cycles: 16 },
  
  0xE0: { opcode: 0xE0, mnemonic: 'LDH', description: 'Load A into (0xFF00+n)', operands: '(n),A', length: 2, cycles: 12 },
  0xE1: { opcode: 0xE1, mnemonic: 'POP', description: 'Pop from stack to HL', operands: 'HL', length: 1, cycles: 12 },
  0xE2: { opcode: 0xE2, mnemonic: 'LD', description: 'Load A into (0xFF00+C)', operands: '(C),A', length: 1, cycles: 8 },
  0xE3: { opcode: 0xE3, mnemonic: 'UNUSED', description: 'Unused opcode', operands: '', length: 1, cycles: 4 },
  0xE4: { opcode: 0xE4, mnemonic: 'UNUSED', description: 'Unused opcode', operands: '', length: 1, cycles: 4 },
  0xE5: { opcode: 0xE5, mnemonic: 'PUSH', description: 'Push HL to stack', operands: 'HL', length: 1, cycles: 16 },
  0xE6: { opcode: 0xE6, mnemonic: 'AND', description: 'AND immediate with A', operands: 'n', length: 2, cycles: 8 },
  0xE7: { opcode: 0xE7, mnemonic: 'RST', description: 'Restart at 0x20', operands: '20H', length: 1, cycles: 16 },
  0xE8: { opcode: 0xE8, mnemonic: 'ADD', description: 'Add signed immediate to SP', operands: 'SP,n', length: 2, cycles: 16 },
  0xE9: { opcode: 0xE9, mnemonic: 'JP', description: 'Jump to HL', operands: '(HL)', length: 1, cycles: 4 },
  0xEA: { opcode: 0xEA, mnemonic: 'LD', description: 'Load A into (nn)', operands: '(nn),A', length: 3, cycles: 16 },
  0xEB: { opcode: 0xEB, mnemonic: 'UNUSED', description: 'Unused opcode', operands: '', length: 1, cycles: 4 },
  0xEC: { opcode: 0xEC, mnemonic: 'UNUSED', description: 'Unused opcode', operands: '', length: 1, cycles: 4 },
  0xED: { opcode: 0xED, mnemonic: 'UNUSED', description: 'Unused opcode', operands: '', length: 1, cycles: 4 },
  0xEE: { opcode: 0xEE, mnemonic: 'XOR', description: 'XOR immediate with A', operands: 'n', length: 2, cycles: 8 },
  0xEF: { opcode: 0xEF, mnemonic: 'RST', description: 'Restart at 0x28', operands: '28H', length: 1, cycles: 16 },
  
  0xF0: { opcode: 0xF0, mnemonic: 'LDH', description: 'Load (0xFF00+n) into A', operands: 'A,(n)', length: 2, cycles: 12 },
  0xF1: { opcode: 0xF1, mnemonic: 'POP', description: 'Pop from stack to AF', operands: 'AF', length: 1, cycles: 12 },
  0xF2: { opcode: 0xF2, mnemonic: 'LD', description: 'Load (0xFF00+C) into A', operands: 'A,(C)', length: 1, cycles: 8 },
  0xF3: { opcode: 0xF3, mnemonic: 'DI', description: 'Disable interrupts', operands: '', length: 1, cycles: 4 },
  0xF4: { opcode: 0xF4, mnemonic: 'UNUSED', description: 'Unused opcode', operands: '', length: 1, cycles: 4 },
  0xF5: { opcode: 0xF5, mnemonic: 'PUSH', description: 'Push AF to stack', operands: 'AF', length: 1, cycles: 16 },
  0xF6: { opcode: 0xF6, mnemonic: 'OR', description: 'OR immediate with A', operands: 'n', length: 2, cycles: 8 },
  0xF7: { opcode: 0xF7, mnemonic: 'RST', description: 'Restart at 0x30', operands: '30H', length: 1, cycles: 16 },
  0xF8: { opcode: 0xF8, mnemonic: 'LD', description: 'Load SP+n into HL', operands: 'HL,SP+n', length: 2, cycles: 12 },
  0xF9: { opcode: 0xF9, mnemonic: 'LD', description: 'Load HL into SP', operands: 'SP,HL', length: 1, cycles: 8 },
  0xFA: { opcode: 0xFA, mnemonic: 'LD', description: 'Load (nn) into A', operands: 'A,(nn)', length: 3, cycles: 16 },
  0xFB: { opcode: 0xFB, mnemonic: 'EI', description: 'Enable interrupts', operands: '', length: 1, cycles: 4 },
  0xFC: { opcode: 0xFC, mnemonic: 'UNUSED', description: 'Unused opcode', operands: '', length: 1, cycles: 4 },
  0xFD: { opcode: 0xFD, mnemonic: 'UNUSED', description: 'Unused opcode', operands: '', length: 1, cycles: 4 },
  0xFE: { opcode: 0xFE, mnemonic: 'CP', description: 'Compare immediate with A', operands: 'n', length: 2, cycles: 8 },
  0xFF: { opcode: 0xFF, mnemonic: 'RST', description: 'Restart at 0x38', operands: '38H', length: 1, cycles: 16 },
};

function analyzeROM(romPath: string): void {
  try {
    console.log(`Analyzing ROM: ${romPath}`);
    
    const rom = readFileSync(romPath);
    console.log(`ROM size: ${rom.length} bytes`);
    
    const opcodes = new Set<number>();
    const cbOpcodes = new Set<number>();
    
    let i = 0;
    while (i < rom.length) {
      const opcode = rom[i];
      
      // Handle CB-prefixed instructions
      if (opcode === 0xCB && i + 1 < rom.length) {
        opcodes.add(opcode);
        i++;
        const cbOpcode = rom[i];
        cbOpcodes.add(cbOpcode);
        i++;
      } else {
        opcodes.add(opcode);
        
        // Skip operand bytes based on instruction length
        const info = INSTRUCTION_SET[opcode];
        if (info) {
          i += info.length;
        } else {
          i++;
        }
      }
    }
    
    console.log(`Found ${opcodes.size} unique opcodes:`);
    console.log(`Found ${cbOpcodes.size} unique CB-prefixed opcodes:`);
    console.log('');
    
    // Display main opcodes
    console.log('=== MAIN OPCODES ===');
    const sortedOpcodes = Array.from(opcodes).sort((a, b) => a - b);
    for (const opcode of sortedOpcodes) {
      const info = INSTRUCTION_SET[opcode];
      if (info) {
        const operands = info.operands ? `,${info.operands}` : '';
        console.log(`0x${opcode.toString(16).toUpperCase().padStart(2, '0')}: ${info.mnemonic}${operands} - ${info.description}`);
      } else {
        console.log(`0x${opcode.toString(16).toUpperCase().padStart(2, '0')}: UNKNOWN`);
      }
    }
    
    // Display CB-prefixed opcodes
    if (cbOpcodes.size > 0) {
      console.log('');
      console.log('=== CB-PREFIXED OPCODES ===');
      const sortedCBOpcodes = Array.from(cbOpcodes).sort((a, b) => a - b);
      for (const cbOpcode of sortedCBOpcodes) {
        console.log(`0xCB${cbOpcode.toString(16).toUpperCase().padStart(2, '0')}: CB-prefixed instruction`);
      }
    }
    
    // Find missing instructions from our instruction set
    console.log('');
    console.log('=== MISSING FROM INSTRUCTION_SET ===');
    const missingOpcodes = sortedOpcodes.filter(opcode => !INSTRUCTION_SET[opcode]);
    if (missingOpcodes.length > 0) {
      for (const opcode of missingOpcodes) {
        console.log(`0x${opcode.toString(16).toUpperCase().padStart(2, '0')}`);
      }
    } else {
      console.log('None - all opcodes are defined!');
    }
    
  } catch (error) {
    console.error(`Error analyzing ROM: ${error}`);
  }
}

// Main execution
const romPath = process.argv[2];
if (!romPath) {
  console.error('Usage: npm run analyze-rom <rom-path>');
  console.error('Example: npm run analyze-rom tetris.gb');
  process.exit(1);
}

analyzeROM(romPath);
