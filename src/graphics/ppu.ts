import { MemoryBus } from '../memory/memory-bus';

/**
 * Game Boy Picture Processing Unit (PPU)
 * Handles graphics rendering, LCD timing, and V-blank interrupts
 */
export class PPU {
  public readonly screenWidth = 160;
  public readonly screenHeight = 144;
  
  private memory: MemoryBus;
  private framebuffer: Uint8Array; // Pixel data (0-3 for 4 shades)
  
  // PPU state
  private _currentLine = 0;
  private _mode = 2; // Start in OAM search
  private _cycles = 0;
  private _vblankRequested = false;
  
  // PPU timing constants (in cycles)
  private static readonly OAM_SEARCH_CYCLES = 80;
  private static readonly PIXEL_TRANSFER_CYCLES = 172;
  // private static readonly HBLANK_CYCLES = 204;
  private static readonly SCANLINE_CYCLES = 456; // Total per scanline
  // private static readonly VBLANK_LINES = 10; // Lines 144-153
  
  // Memory addresses
  private static readonly LCD_CONTROL = 0xFF40;
  private static readonly LCD_STATUS = 0xFF41;
  private static readonly SCROLL_Y = 0xFF42;
  private static readonly SCROLL_X = 0xFF43;
  private static readonly LY = 0xFF44; // Current scanline
  private static readonly LYC = 0xFF45; // Scanline compare
  
  // VRAM addresses
  private static readonly TILE_DATA_0 = 0x8000; // Tiles 0-127
  // private static readonly TILE_DATA_1 = 0x8800; // Tiles 128-255 (signed)
  private static readonly TILE_MAP_0 = 0x9800; // Background map 0
  private static readonly TILE_MAP_1 = 0x9C00; // Background map 1

  constructor(memory: MemoryBus) {
    this.memory = memory;
    this.framebuffer = new Uint8Array(this.screenWidth * this.screenHeight);
    
    // Initialize framebuffer to black (value 3 = darkest)
    this.framebuffer.fill(3);
    
    // Initialize LCD registers to post-boot state
    this.memory.write8(PPU.LCD_CONTROL, 0x91); // LCD on, background on
    this.memory.write8(PPU.LCD_STATUS, 0x00);
    this.memory.write8(PPU.SCROLL_Y, 0x00);
    this.memory.write8(PPU.SCROLL_X, 0x00);
    this.memory.write8(PPU.LY, 0x00);
    this.memory.write8(PPU.LYC, 0x00);
  }

  get currentLine(): number {
    return this._currentLine;
  }

  get mode(): number {
    return this._mode;
  }

  get vblankRequested(): boolean {
    return this._vblankRequested;
  }

  /**
   * Step the PPU forward by the given number of cycles
   */
  step(cycles: number): void {
    this._cycles += cycles;
    
    // Update LY register
    this.memory.write8(PPU.LY, this._currentLine);
    
    if (this._currentLine < 144) {
      // Visible scanlines (0-143)
      this.handleVisibleScanline();
    } else {
      // V-blank period (lines 144-153)
      this.handleVBlankPeriod();
    }
  }

  /**
   * Handle timing for visible scanlines
   */
  private handleVisibleScanline(): void {
    if (this._cycles >= PPU.SCANLINE_CYCLES) {
      // Complete scanline, move to next
      this._cycles -= PPU.SCANLINE_CYCLES;
      this.renderScanline();
      this._currentLine++;
      
      if (this._currentLine === 144) {
        // Entering V-blank - trigger interrupt for each frame
        this._mode = 1;
        this._vblankRequested = true;
      }
    } else {
      // Determine current mode based on cycle position
      if (this._cycles < PPU.OAM_SEARCH_CYCLES) {
        this._mode = 2; // OAM search
      } else if (this._cycles < PPU.OAM_SEARCH_CYCLES + PPU.PIXEL_TRANSFER_CYCLES) {
        this._mode = 3; // Pixel transfer
      } else {
        this._mode = 0; // H-blank
      }
    }
    
    // Update LCD status register
    this.updateLCDStatus();
  }

  /**
   * Handle V-blank period timing
   */
  private handleVBlankPeriod(): void {
    if (this._cycles >= PPU.SCANLINE_CYCLES) {
      this._cycles -= PPU.SCANLINE_CYCLES;
      this._currentLine++;
      
      if (this._currentLine > 153) {
        // End of V-blank, restart at line 0
        this._currentLine = 0;
        this._mode = 2; // Start with OAM search
      }
    }
    
    this.updateLCDStatus();
  }

  /**
   * Update the LCD status register
   */
  private updateLCDStatus(): void {
    let status = this.memory.read8(PPU.LCD_STATUS) & 0xFC; // Keep upper bits
    status |= this._mode; // Set mode bits
    
    // Set LYC=LY flag if they match
    if (this._currentLine === this.memory.read8(PPU.LYC)) {
      status |= 0x04;
    }
    
    this.memory.write8(PPU.LCD_STATUS, status);
  }

  /**
   * Render the current scanline to the framebuffer
   */
  renderScanline(): void {
    const lcdControl = this.memory.read8(PPU.LCD_CONTROL);
    
    // Check if LCD is enabled
    if ((lcdControl & 0x80) === 0) {
      // LCD is off - fill scanline with lightest color (off state)
      this.fillScanlineWithColor(0);
      return;
    }
    
    // Check if background is enabled
    if ((lcdControl & 0x01) === 0) {
      // Background off - fill with white
      this.fillScanlineWithColor(0);
    } else {
      this.renderBackgroundScanline();
    }
    
    // Check if sprites are enabled
    if ((lcdControl & 0x02) !== 0) {
      this.renderSpriteScanline();
    }
  }

  /**
   * Render the background for the current scanline
   */
  private renderBackgroundScanline(): void {
    const lcdControl = this.memory.read8(PPU.LCD_CONTROL);
    const scrollY = this.memory.read8(PPU.SCROLL_Y);
    const scrollX = this.memory.read8(PPU.SCROLL_X);
    
    // Determine tile map address
    const tileMapBase = (lcdControl & 0x08) ? PPU.TILE_MAP_1 : PPU.TILE_MAP_0;
    
    // Determine tile data addressing mode
    const unsignedTileData = (lcdControl & 0x10) !== 0;
    
    // Calculate which background row we're drawing
    const backgroundY = (this._currentLine + scrollY) & 0xFF;
    const tileRow = Math.floor(backgroundY / 8);
    const tileRowOffset = backgroundY % 8;
    
    // Render each pixel in the scanline
    for (let screenX = 0; screenX < this.screenWidth; screenX++) {
      const backgroundX = (screenX + scrollX) & 0xFF;
      const tileCol = Math.floor(backgroundX / 8);
      const tileColOffset = backgroundX % 8;
      
      // Get tile index from tile map
      const tileMapAddress = tileMapBase + (tileRow * 32) + tileCol;
      const tileIndex = this.memory.read8(tileMapAddress);
      
      // Calculate tile data address
      let tileDataAddress: number;
      if (unsignedTileData) {
        // Unsigned: 0x8000 + (index * 16)
        tileDataAddress = PPU.TILE_DATA_0 + (tileIndex * 16);
      } else {
        // Signed: 0x9000 + (signed_index * 16)
        const signedIndex = tileIndex > 127 ? tileIndex - 256 : tileIndex;
        tileDataAddress = 0x9000 + (signedIndex * 16);
      }
      
      // Get the two bytes for this row of the tile
      const byte1 = this.memory.read8(tileDataAddress + (tileRowOffset * 2));
      const byte2 = this.memory.read8(tileDataAddress + (tileRowOffset * 2) + 1);
      
      // Extract the pixel value (2 bits)
      const bitIndex = 7 - tileColOffset;
      const bit1 = (byte1 >> bitIndex) & 1;
      const bit2 = (byte2 >> bitIndex) & 1;
      const pixelValue = (bit2 << 1) | bit1;
      
      // Map to grayscale (0 = white, 3 = black)
      const grayscale = this.mapToGrayscale(pixelValue);
      
      // Set pixel in framebuffer
      const bufferIndex = (this._currentLine * this.screenWidth) + screenX;
      this.framebuffer[bufferIndex] = grayscale;
    }
  }

  /**
   * Render sprites for the current scanline
   */
  private renderSpriteScanline(): void {
    const lcdControl = this.memory.read8(PPU.LCD_CONTROL);
    const spriteHeight = (lcdControl & 0x04) ? 16 : 8; // 8x8 or 8x16 sprites
    
    // Game Boy can display up to 10 sprites per scanline, but we need to check all 40
    const spritesOnLine: Array<{x: number, y: number, tileIndex: number, attributes: number, oamIndex: number}> = [];
    
    // Check all 40 sprites in OAM (0xFE00-0xFE9F)
    for (let spriteIndex = 0; spriteIndex < 40; spriteIndex++) {
      const oamAddress = 0xFE00 + (spriteIndex * 4);
      
      const spriteY = this.memory.read8(oamAddress);     // Y position
      const spriteX = this.memory.read8(oamAddress + 1); // X position  
      const tileIndex = this.memory.read8(oamAddress + 2); // Tile index
      const attributes = this.memory.read8(oamAddress + 3); // Attributes
      
      // Convert coordinates (Game Boy uses offset coordinates)
      const actualY = spriteY - 16;
      const actualX = spriteX - 8;
      
      // Check if sprite is on current scanline
      if (this._currentLine >= actualY && this._currentLine < actualY + spriteHeight) {
        spritesOnLine.push({
          x: actualX,
          y: actualY,
          tileIndex: tileIndex,
          attributes: attributes,
          oamIndex: spriteIndex
        });
      }
      
      // Game Boy hardware limit: max 10 sprites per scanline
      if (spritesOnLine.length >= 10) {
        break;
      }
    }
     // Sort sprites by X position (leftmost first, then by OAM index for priority)
    spritesOnLine.sort((a, b) => {
      if (a.x === b.x) {
        return a.oamIndex - b.oamIndex; // Lower OAM index = higher priority
      }
      return a.x - b.x;
    });

    // Render sprites from lowest priority to highest (reverse order for proper layering)
    for (let i = spritesOnLine.length - 1; i >= 0; i--) {
      this.renderSprite(spritesOnLine[i], spriteHeight);
    }
  }

  /**
   * Render a single sprite on the current scanline
   */
  private renderSprite(sprite: {x: number, y: number, tileIndex: number, attributes: number, oamIndex: number}, spriteHeight: number): void {
    // Calculate which row of the sprite we're rendering
    const spriteRow = this._currentLine - sprite.y;
    
    // Extract sprite attributes
    const flipX = (sprite.attributes & 0x20) !== 0;
    const flipY = (sprite.attributes & 0x40) !== 0;
    const belowBG = (sprite.attributes & 0x80) !== 0; // Sprite priority (behind background)
    
    // Calculate which row of the sprite to render
    let tileRow = flipY ? (spriteHeight - 1 - spriteRow) : spriteRow;
    
    // For 8x16 sprites, handle tile index differently
    let actualTileIndex = sprite.tileIndex;
    if (spriteHeight === 16) {
      if (tileRow >= 8) {
        actualTileIndex = sprite.tileIndex | 0x01; // Bottom tile (odd index)
        tileRow -= 8;
      } else {
        actualTileIndex = sprite.tileIndex & 0xFE; // Top tile (even index)
      }
    }
    
    // Get tile data address (sprites always use 0x8000-0x8FFF region)
    const tileDataAddress = 0x8000 + (actualTileIndex * 16);
    
    // Get the two bytes for this row of the sprite tile
    const byte1 = this.memory.read8(tileDataAddress + (tileRow * 2));
    const byte2 = this.memory.read8(tileDataAddress + (tileRow * 2) + 1);
    
    // Render each pixel of the sprite
    for (let pixelX = 0; pixelX < 8; pixelX++) {
      const screenX = sprite.x + pixelX;
      
      // Skip pixels outside screen bounds
      if (screenX < 0 || screenX >= this.screenWidth) {
        continue;
      }
      
      // Calculate bit index (with horizontal flip)
      const bitIndex = flipX ? pixelX : (7 - pixelX);
      const bit1 = (byte1 >> bitIndex) & 1;
      const bit2 = (byte2 >> bitIndex) & 1;
      const pixelValue = (bit2 << 1) | bit1;
       // Transparent pixels (color 0) are not drawn
      if (pixelValue === 0) {
        continue;
      }

      const bufferIndex = (this._currentLine * this.screenWidth) + screenX;
      
      // Check sprite priority vs background
      if (belowBG) {
        // Sprite is behind background - only draw if background pixel is color 0
        const bgPixel = this.framebuffer[bufferIndex];
        if (bgPixel !== 0) {
          continue; // Don't draw sprite pixel
        }
      }
      
      // Map sprite pixel using sprite palette
      const grayscale = this.mapSpriteToGrayscale(pixelValue);
      this.framebuffer[bufferIndex] = grayscale;
    }
  }

  /**
   * Fill the current scanline with a solid color
   */
  private fillScanlineWithColor(color: number): void {
    const start = this._currentLine * this.screenWidth;
    const end = start + this.screenWidth;
    this.framebuffer.fill(color, start, end);
  }

  /**
   * Map Game Boy palette value to grayscale
   */
  private mapToGrayscale(paletteValue: number): number {
    // Default palette: 0=white, 1=light gray, 2=dark gray, 3=black
    switch (paletteValue) {
      case 0: return 0; // White
      case 1: return 1; // Light gray
      case 2: return 2; // Dark gray
      case 3: return 3; // Black
      default: return 0;
    }
  }

  /**
   * Map sprite pixel using sprite palette
   */
  private mapSpriteToGrayscale(pixelValue: number): number {
    // For now, use same mapping as background
    // In a full implementation, you'd read from sprite palette registers (0xFF48, 0xFF49)
    // But sprites use palettes differently - color 0 is always transparent
    switch (pixelValue) {
      case 0: return 0; // Transparent (shouldn't reach here)
      case 1: return 1; // Light gray
      case 2: return 2; // Dark gray  
      case 3: return 3; // Black
      default: return 0;
    }
  }

  /**
   * Get the current framebuffer
   */
  getFramebuffer(): Uint8Array {
    return this.framebuffer;
  }

  /**
   * Clear V-blank request flag
   */
  clearVBlankRequest(): void {
    this._vblankRequested = false;
  }
}
