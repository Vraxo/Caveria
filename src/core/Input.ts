export class Input {
  private readonly keysDown = new Set<string>();
  private readonly keysPressed = new Set<string>();
  private readonly mousePressed = new Set<number>();

  public mouseDeltaX = 0;
  public mouseDeltaY = 0;
  public wheelDelta = 0;
  public isPointerLocked = false;

  private readonly canvas: HTMLElement;
  private onLockChangeCallback?: (locked: boolean) => void;

  constructor(canvas: HTMLElement) {
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (!this.keysDown.has(e.code)) {
        this.keysPressed.add(e.code);
      }
      this.keysDown.add(e.code);

      if (e.code === 'F3' || (this.isPointerLocked && ['Space', 'ArrowUp', 'ArrowDown'].includes(e.code))) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keysDown.clear();
      this.keysPressed.clear();
      this.mousePressed.clear();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked) return;
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    });

    window.addEventListener('mousedown', (e) => {
      if (!this.isPointerLocked) return;
      this.mousePressed.add(e.button);
    });

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.isPointerLocked) return;
        e.preventDefault();
        this.wheelDelta += Math.sign(e.deltaY);
      },
      { passive: false }
    );

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.canvas;
      if (!this.isPointerLocked) {
        this.keysDown.clear();
      }
      this.onLockChangeCallback?.(this.isPointerLocked);
    });
  }

  public onPointerLockChange(cb: (locked: boolean) => void): void {
    this.onLockChangeCallback = cb;
  }

  public requestPointerLock(): void {
    this.canvas.requestPointerLock();
  }

  public isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }

  public consumeKeyPress(code: string): boolean {
    if (this.keysPressed.has(code)) {
      this.keysPressed.delete(code);
      return true;
    }
    return false;
  }

  public consumeMousePress(button: number): boolean {
    if (this.mousePressed.has(button)) {
      this.mousePressed.delete(button);
      return true;
    }
    return false;
  }

  public endFrame(): void {
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.wheelDelta = 0;
    this.keysPressed.clear();
    this.mousePressed.clear();
  }
}
