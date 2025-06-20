/**
 * Game Boy Joypad Input Handler
 * Handles the 8-button joypad input and P1 register (0xFF00)
 */
export class Joypad {
  // Button states (true = pressed)
  private buttonA = false;
  private buttonB = false;
  private buttonSelect = false;
  private buttonStart = false;
  private directionUp = false;
  private directionDown = false;
  private directionLeft = false;
  private directionRight = false;
  
  // P1 register selection bits (written by game)
  private p1Register = 0xFF; // Start with all bits high
  
  /**
   * Set button state
   */
  setButton(button: string, pressed: boolean): void {
    switch (button) {
      case 'A':
        this.buttonA = pressed;
        break;
      case 'B':
        this.buttonB = pressed;
        break;
      case 'Select':
        this.buttonSelect = pressed;
        break;
      case 'Start':
        this.buttonStart = pressed;
        break;
      case 'Up':
        this.directionUp = pressed;
        break;
      case 'Down':
        this.directionDown = pressed;
        break;
      case 'Left':
        this.directionLeft = pressed;
        break;
      case 'Right':
        this.directionRight = pressed;
        break;
    }
  }
  
  /**
   * Write to P1 register (0xFF00)
   * Game writes to select which button group to read
   */
  writeP1(value: number): void {
    // Store the selection bits (bits 4-5)
    this.p1Register = (this.p1Register & 0x0F) | (value & 0x30);
  }
  
  /**
   * Read from P1 register (0xFF00)
   * Returns button states based on current selection
   */
  readP1(): number {
    let result = this.p1Register & 0xF0; // Keep upper bits
    
    const selectButtons = (this.p1Register & 0x20) === 0; // Bit 5: 0 = select action buttons
    const selectDirections = (this.p1Register & 0x10) === 0; // Bit 4: 0 = select direction pad
    
    // Start with all buttons not pressed (bits = 1)
    let buttonBits = 0x0F;
    
    if (selectButtons) {
      // Action buttons selected (A, B, Select, Start)
      if (this.buttonA) buttonBits &= ~0x01;
      if (this.buttonB) buttonBits &= ~0x02; 
      if (this.buttonSelect) buttonBits &= ~0x04;
      if (this.buttonStart) buttonBits &= ~0x08;
    } else if (selectDirections) {
      // Direction pad selected (Right, Left, Up, Down)
      if (this.directionRight) buttonBits &= ~0x01;
      if (this.directionLeft) buttonBits &= ~0x02;
      if (this.directionUp) buttonBits &= ~0x04;
      if (this.directionDown) buttonBits &= ~0x08;
    }
    
    return result | buttonBits;
  }
}
