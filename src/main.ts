/**
 * Game Boy Emulator - Main Entry Point
 */

import { GameBoy } from './gameboy';

class EmulatorApp {
  private gameboy: GameBoy;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isRunning = false;
  private animationId?: number;
  private lastFrameTime = 0;
  
  // Game Boy screen is 160x144, but we scale it up
  private readonly SCREEN_WIDTH = 160;
  private readonly SCREEN_HEIGHT = 144;
  private readonly SCALE = 2; // 2x scaling for better visibility
  private readonly TARGET_FPS = 60; // Close to Game Boy's 59.7 Hz
  private readonly FRAME_TIME = 1000 / this.TARGET_FPS;

  constructor() {
    this.canvas = document.getElementById('gameboy-screen') as HTMLCanvasElement;
    if (!this.canvas) {
      throw new Error('Canvas element not found');
    }

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context from canvas');
    }
    this.ctx = ctx;

    // Set canvas actual size
    this.canvas.width = this.SCREEN_WIDTH;
    this.canvas.height = this.SCREEN_HEIGHT;
    
    // Scale the display
    this.canvas.style.width = `${this.SCREEN_WIDTH * this.SCALE}px`;
    this.canvas.style.height = `${this.SCREEN_HEIGHT * this.SCALE}px`;
    
    // Make canvas focusable for keyboard input
    this.canvas.tabIndex = 0;
    this.canvas.focus();

    // Initialize Game Boy
    this.gameboy = new GameBoy();
    
    this.setupUI();
    this.initializeDisplay();
    
    console.log('Game Boy Emulator initialized!');
  }

  private setupUI(): void {
    const loadGameButton = document.getElementById('load-game') as HTMLButtonElement;
    const startButton = document.getElementById('start') as HTMLButtonElement;
    const pauseButton = document.getElementById('pause') as HTMLButtonElement;
    const resetButton = document.getElementById('reset') as HTMLButtonElement;
    const startAudioButton = document.getElementById('start-audio') as HTMLButtonElement;
    const fullscreenButton = document.getElementById('fullscreen') as HTMLButtonElement;

    loadGameButton?.addEventListener('click', () => this.loadROM('/blocks.gb', 'Block Puzzle Game'));
    startButton?.addEventListener('click', () => this.start());
    pauseButton?.addEventListener('click', () => this.pause());
    resetButton?.addEventListener('click', () => this.reset());
    startAudioButton?.addEventListener('click', () => {
      this.gameboy.soundChip.startAudio();
    });
    fullscreenButton?.addEventListener('click', () => this.enterFullscreen());

    // Keyboard controls
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    
    // Canvas click to focus for keyboard input
    this.canvas.addEventListener('click', () => {
      this.canvas.focus();
    });
  }

  private initializeDisplay(): void {
    // Initialize with a Game Boy green screen
    this.ctx.fillStyle = '#9bbc0f';
    this.ctx.fillRect(0, 0, this.SCREEN_WIDTH, this.SCREEN_HEIGHT);

    // Add text
    this.ctx.fillStyle = '#0f380f';
    this.ctx.font = '8px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Game Boy Emulator', this.SCREEN_WIDTH / 2, this.SCREEN_HEIGHT / 2 - 10);
    this.ctx.fillText('Press "Load ROM" to start', this.SCREEN_WIDTH / 2, this.SCREEN_HEIGHT / 2 + 10);
  }

  private async loadROM(romPath: string, romName: string): Promise<void> {
    try {
      const response = await fetch(romPath);
      if (!response.ok) {
        throw new Error(`Failed to load ROM: ${response.statusText}`);
      }
      
      const romData = new Uint8Array(await response.arrayBuffer());
      this.gameboy.loadRom(romData);
      
      console.log(`${romName} ROM loaded successfully!`);
      console.log(`ROM size: ${romData.length} bytes`);
      
      // Update display
      this.ctx.fillStyle = '#9bbc0f';
      this.ctx.fillRect(0, 0, this.SCREEN_WIDTH, this.SCREEN_HEIGHT);
      this.ctx.fillStyle = '#0f380f';
      this.ctx.font = '8px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`${romName} ROM Loaded!`, this.SCREEN_WIDTH / 2, this.SCREEN_HEIGHT / 2 - 10);
      this.ctx.fillText('Press "Start" to begin', this.SCREEN_WIDTH / 2, this.SCREEN_HEIGHT / 2 + 10);
      
    } catch (error) {
      console.error('Failed to load ROM:', error);
      alert(`Failed to load ${romName} ROM. Make sure ${romPath} is in the public directory.`);
    }
  }

  private start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('Starting emulation...');
    this.emulationLoop();
  }

  private pause(): void {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    console.log('Emulation paused');
  }

  private reset(): void {
    this.pause();
    this.gameboy = new GameBoy();
    this.initializeDisplay();
    console.log('Emulator reset');
  }

  private emulationLoop(): void {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;

    // Only run if enough time has passed for the next frame
    if (deltaTime >= this.FRAME_TIME) {
      this.lastFrameTime = currentTime;

      try {
        // Run one complete frame
        this.gameboy.runFrame();

        // Render the frame
        this.renderFrame();

      } catch (error) {
        console.error('Emulation error:', error);
        this.pause();
        return;
      }
    }

    // Schedule next frame
    this.animationId = requestAnimationFrame(() => this.emulationLoop());
  }

  private renderFrame(): void {
    // Get the framebuffer from the PPU
    const framebuffer = this.gameboy.getScreenData();
    
    // Create ImageData from the framebuffer
    const imageData = this.ctx.createImageData(this.SCREEN_WIDTH, this.SCREEN_HEIGHT);
    
    // Convert grayscale framebuffer to RGBA
    // Game Boy has 4 shades of green
    const palette = [
      [0x9b, 0xbc, 0x0f, 255], // Lightest
      [0x8b, 0xac, 0x0f, 255], // Light
      [0x30, 0x62, 0x30, 255], // Dark
      [0x0f, 0x38, 0x0f, 255], // Darkest
    ];

    for (let i = 0; i < framebuffer.length; i++) {
      const pixelValue = framebuffer[i] & 0x03; // Ensure 2-bit value
      const color = palette[pixelValue];
      const pixelIndex = i * 4;
      
      imageData.data[pixelIndex] = color[0];     // R
      imageData.data[pixelIndex + 1] = color[1]; // G
      imageData.data[pixelIndex + 2] = color[2]; // B
      imageData.data[pixelIndex + 3] = color[3]; // A
    }

    // Draw to canvas
    this.ctx.putImageData(imageData, 0, 0);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // Map keyboard to Game Boy controls
    const keyMap: { [key: string]: string } = {
      'ArrowUp': 'Up',
      'ArrowDown': 'Down', 
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right',
      'KeyZ': 'A',
      'KeyX': 'B',
      'Enter': 'Start',
      'Backspace': 'Select',
    };

    const button = keyMap[event.code];
    if (button) {
      this.gameboy.setJoypadButton(button, true);
      event.preventDefault();
    }
  }

  private handleKeyUp(event: KeyboardEvent): void {
    // Map keyboard to Game Boy controls
    const keyMap: { [key: string]: string } = {
      'ArrowUp': 'Up',
      'ArrowDown': 'Down', 
      'ArrowLeft': 'Left',
      'ArrowRight': 'Right',
      'KeyZ': 'A',
      'KeyX': 'B',
      'Enter': 'Start',
      'Backspace': 'Select',
    };

    const button = keyMap[event.code];
    if (button) {
      this.gameboy.setJoypadButton(button, false);
      event.preventDefault();
    }
  }

  private enterFullscreen(): void {
    // Use the parent of the canvas for fullscreen to include border
    const container = this.canvas.parentElement || this.canvas;
    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if ((container as any).webkitRequestFullscreen) {
      (container as any).webkitRequestFullscreen();
    }
    // Listen for fullscreen change to resize canvas
    document.addEventListener('fullscreenchange', () => this.resizeCanvasForFullscreen());
    document.addEventListener('webkitfullscreenchange', () => this.resizeCanvasForFullscreen());
  }

  private resizeCanvasForFullscreen(): void {
    const isFullscreen = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (isFullscreen) {
      // Fit canvas to screen, preserving aspect ratio (160:144)
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      const aspect = this.SCREEN_WIDTH / this.SCREEN_HEIGHT;
      let width = screenW;
      let height = Math.round(width / aspect);
      if (height > screenH) {
        height = screenH;
        width = Math.round(height * aspect);
      }
      this.canvas.style.width = width + 'px';
      this.canvas.style.height = height + 'px';
    } else {
      // Restore default scaling
      this.canvas.style.width = (this.SCREEN_WIDTH * this.SCALE) + 'px';
      this.canvas.style.height = (this.SCREEN_HEIGHT * this.SCALE) + 'px';
    }
  }
}

// Initialize the emulator when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new EmulatorApp();
});
