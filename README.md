# Game Boy Emulator

A fully functional Nintendo Game Boy emulator written in TypeScript, capable of running classic puzzle games with complete graphics, sound, and input support.

## 🤖 Vibe Coding Experiment: AI-Only Development

**This entire emulator was written solely by AI using "Vibe Coding"—an experimental approach where the AI writes all code without direct human programming.** The human engineer did not touch any code files during development, only providing guidance, reviewing results, and using undo when the AI encountered issues.

### AI Collaboration Details
- **Claude Sonnet 4** handled the initial architecture, core CPU, PPU, memory, input, and overall emulator structure. Claude also addressed major architectural and logic bugs, including sprite and DMA issues, and performed the foundational debugging and integration work.
- **GPT-4.1** focused on sound (APU) implementation, audio smoothing, and deep performance optimizations. This included refactoring the CPU, PPU, and APU for O(1) array access and cache-friendly data structures, adding a fullscreen UI button, improving browser compatibility, and diagnosing/addressing missing sound issues. Profiling and systematic debugging strategies were also introduced at this stage.

**At no point did the driving engineer directly modify the code. All changes were made by the AI agents.**

## 🛠️ Major Problems and Solutions

- **Sound Quality Issues:**
  - Problem: Audio output was harsh or missing on some channels
  - Solution: Added a low-pass filter, tuned smoothing, and debugged channel enable/trigger logic (GPT-4.1)

- **Performance Bottlenecks:**
  - Problem: Emulator was slow due to property access and inefficient data structures
  - Solution: Refactored CPU, PPU, and APU to use `Uint8Array` and direct array access for all hot paths (registers, palettes, memory, etc.) (GPT-4.1)

- **Sprite and DMA Bugs:**
  - Problem: Sprites were invisible or corrupted due to coordinate and DMA issues
  - Solution: Complete rewrite of sprite rendering and OAM DMA logic (Claude Sonnet 4)

- **Debugging and Profiling:**
  - Problem: Difficult to isolate performance and sound bugs
  - Solution: Systematic profiling, step-by-step refactoring, and clear separation of concerns (GPT-4.1)

## 📝 Expanded Technical Notes

- **Sound (APU):**
  - Added low-pass filter for smoother audio
  - Refactored square wave channel to use O(1) register access
  - Debugged and improved channel enable/trigger logic
- **CPU/PPU:**
  - All register and palette accesses are now O(1) via `Uint8Array` and constants
  - Instruction handlers refactored for direct array access (e.g., `regs[REG_A]`)
- **UI:**
  - Fullscreen button added using the Fullscreen API, maintaining correct aspect ratio
- **Browser Compatibility:**
  - All features tested in modern browsers for smooth performance

## 🎮 Features

- **Complete LR35902 CPU emulation** - All Game Boy CPU instructions implemented
- **Accurate PPU (Graphics)** - Background tiles, sprites, scanline rendering
- **Memory bus** - Proper Game Boy memory mapping (ROM, VRAM, OAM, Work RAM)
- **Timer system** - DIV/TIMA registers with interrupt support
- **Input handling** - Full joypad support with keyboard mapping
- **OAM DMA** - Sprite data transfers
- **V-blank interrupts** - Proper display timing
- **Sprite rendering** - All piece types with transparency and priority

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open your browser to `http://localhost:3000` and enjoy classic puzzle gaming!

### Controls
- **Arrow Keys**: Move pieces left/right/down
- **Z**: A button (rotate)
- **X**: B button
- **Enter**: Start
- **Space**: Select

## 📋 Development Timeline

### Phase 1: Foundation (Sessions 1-3)
- ✅ Project setup with Vite, TypeScript, Vitest
- ✅ CPU registers implementation and testing
- ✅ Memory bus architecture
- ✅ Basic CPU instruction framework

### Phase 2: CPU Implementation (Sessions 4-8)
- ✅ Core CPU instructions (LD, ADD, SUB, etc.)
- ✅ Jump and branch instructions
- ✅ Stack operations (PUSH, POP, CALL, RET)
- ✅ 16-bit arithmetic and operations
- **⚠️ Issue**: Complex instruction decoding led to multiple refactoring attempts

### Phase 3: Graphics Foundation (Sessions 9-12)
- ✅ PPU basic structure
- ✅ LCD control registers
- ✅ Background tile rendering
- ✅ VRAM management
- **⚠️ Issue**: Initial sprite rendering attempts failed due to coordinate system confusion

### Phase 4: Integration & ROM Loading (Sessions 13-16)
- ✅ Game Boy main class integration
- ✅ ROM loading and analysis
- ✅ Tetris-specific instruction verification
- **🔥 Major Issue**: Screen tearing and timing problems required multiple debugging sessions

### Phase 5: Interrupt System (Sessions 17-20)
- ✅ V-blank interrupt implementation
- ✅ IME flag and EI/DI instructions
- ✅ RETI instruction
- ✅ Interrupt priority and vector handling
- **⚠️ Issue**: Infinite interrupt loops required careful timing fixes

### Phase 6: Input System (Sessions 21-24)
- ✅ Joypad implementation
- ✅ Keyboard event mapping
- ✅ P1 register (0xFF00) handling
- ✅ Button state management
- **⚠️ Issue**: Input detection required multiple debugging sessions

### Phase 7: Sprite Crisis (Sessions 25-30)
- ❌ Initial sprite implementation completely broken
- ❌ Coordinate system bugs causing invisible sprites
- ❌ OAM memory access issues
- **🔥 Critical Issue**: Sprites not appearing at all, requiring complete rewrite

### Phase 8: The Great Debugging (Sessions 31-35)
- 🔍 Deep debugging of OAM memory
- 🔍 Analysis of sprite data flow
- 🔍 Memory mapping verification
- **💡 Breakthrough**: Discovered missing OAM DMA implementation

### Phase 9: OAM DMA Implementation (Sessions 36-38)
- ✅ OAM DMA register (0xFF46) implementation
- ✅ Sprite data transfer functionality
- ✅ Proper Game Boy initialization
- **🎯 Success**: Sprites finally appeared!

### Phase 10: The Random Crisis (Sessions 39-42)
- 🔍 Only square pieces appearing
- 🔍 Random number generation investigation
- 🔍 Timer system implementation
- **⚠️ Issue**: All pieces looked identical despite working sprite system

### Phase 11: Timer & RNG Fix (Sessions 43-45)
- ✅ DIV register implementation
- ✅ TIMA/TMA/TAC timer registers
- ✅ Timer interrupts
- **💡 Final Breakthrough**: Added timing variation to DIV register for proper RNG

### Phase 12: Performance Optimization (Session 46)
- ✅ Removed all debug logging
- ✅ Performance optimization
- ✅ Clean, production-ready code

## 🐛 Major Issues Encountered

### 1. **The Sprite Coordinate Crisis** (Sessions 25-30)
**Problem**: Sprites were completely invisible
**Root Cause**: Bug in sprite rendering where X coordinate was used instead of Y coordinate
**Solution**: Complete sprite rendering rewrite with proper coordinate handling

### 2. **The Missing DMA Mystery** (Sessions 31-35)  
**Problem**: Sprite data never appeared in OAM
**Root Cause**: OAM DMA (0xFF46) register not implemented
**Solution**: Implemented proper DMA transfers from Work RAM to OAM

### 3. **The Random Number Disaster** (Sessions 39-42)
**Problem**: Only square pieces generated
**Root Cause**: DIV register too predictable for the game's RNG
**Solution**: Added realistic timing variations to emulate hardware imperfections

### 4. **Performance Apocalypse** (Session 46)
**Problem**: Emulator running extremely slowly
**Root Cause**: Thousands of console.log statements per second
**Solution**: Removed all debug logging

## 🧠 Engineering Knowledge Required

While this was an AI-driven project, several areas required engineering expertise:

1. **Game Boy Architecture**: Understanding memory mapping, timing, and hardware behavior
2. **Emulation Concepts**: CPU cycles, scanline rendering, interrupt timing
3. **Debugging Methodology**: Systematic approach to isolating complex bugs
4. **Performance Optimization**: Understanding JavaScript performance bottlenecks

## 🎯 Key Insights

### What Worked Well
- **Incremental development** with extensive testing
- **Modular architecture** made debugging manageable  
- **Systematic debugging** helped isolate complex issues
- **AI persistence** in solving difficult problems

### What Was Challenging
- **Complex coordinate transformations** in graphics programming
- **Hardware timing emulation** requiring deep Game Boy knowledge
- **Debugging invisible issues** (sprites not rendering)
- **Performance optimization** balancing debugging vs. speed

## 🏗️ Architecture

```
src/
├── cpu/
│   ├── registers.ts    # CPU register management
│   └── cpu.ts         # LR35902 CPU implementation
├── memory/
│   └── memory-bus.ts  # Memory mapping and timing
├── graphics/
│   └── ppu.ts         # Picture Processing Unit
├── input/
│   └── joypad.ts      # Input handling
└── gameboy.ts         # Main emulator class
```

## 🧪 Testing

Comprehensive test suite covering:
- CPU instruction accuracy
- Memory operations
- Register state management
- Edge cases and error conditions

```bash
npm test
```

## 🎮 Games Tested

- **Classic Puzzle Game** - Fully playable with all piece types
- Designed to be compatible with other Game Boy ROMs

## 🔮 Future Improvements

- Sound/audio implementation (APU)
- Save state functionality  
- Additional ROM compatibility
- Mobile touch controls
- Game Genie cheat code support

## ⚠️ Disclaimer

This is an experimental project demonstrating AI coding capabilities. While functional, it may not be suitable for production use without additional testing and optimization.

## 📄 License

MIT License - See LICENSE file for details

---

**Built with TypeScript, Vite, and a lot of AI persistence! 🤖**
