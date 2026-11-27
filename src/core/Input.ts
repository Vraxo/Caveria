/** Returns true when the current browser/device reports touch input capability. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
    window.matchMedia?.('(pointer: coarse)').matches === true
  );
}

function isCoarsePointerPrimary(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(pointer: coarse)').matches === true;
}

export class Input {
  private readonly keysDown = new Set<string>();
  private readonly virtualKeysDown = new Set<string>();
  private readonly keysPressed = new Set<string>();
  private readonly mouseDown = new Set<number>();
  private readonly virtualMouseDown = new Set<number>();
  private readonly mousePressed = new Set<number>();
  private readonly mouseReleased = new Set<number>();

  public mouseDeltaX = 0;
  public mouseDeltaY = 0;
  public wheelDelta = 0;
  /** Analog horizontal strafe from virtual joystick (-1 left .. +1 right). */
  public virtualMoveX = 0;
  /** Analog forward/backward input from virtual joystick (-1 back .. +1 forward). */
  public virtualMoveForward = 0;
  public isPointerLocked = false;
  /** True when gameplay is using mobile touch controls instead of desktop pointer lock. */
  public touchMode = false;

  private lastInputWasTouch = isCoarsePointerPrimary();
  private readonly canvas: HTMLElement;
  private onLockChangeCallback?: (locked: boolean) => void;

  constructor(canvas: HTMLElement) {
    this.canvas = canvas;

    window.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'touch') this.lastInputWasTouch = true;
        else if (e.pointerType === 'mouse') this.lastInputWasTouch = false;
      },
      { passive: true }
    );

    window.addEventListener(
      'touchstart',
      () => {
        this.lastInputWasTouch = true;
      },
      { passive: true }
    );

    window.addEventListener('keydown', (e) => {
      if (!this.keysDown.has(e.code)) {
        this.keysPressed.add(e.code);
      }
      this.keysDown.add(e.code);

      if (
        e.code === 'F3' ||
        (this.isPointerLocked && ['Space', 'ArrowUp', 'ArrowDown'].includes(e.code))
      ) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysDown.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.clearAllInputs();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked || this.touchMode) return;
      this.mouseDeltaX += e.movementX;
      this.mouseDeltaY += e.movementY;
    });

    window.addEventListener('mousedown', (e) => {
      if (!this.isPointerLocked || this.touchMode) return;
      this.mouseDown.add(e.button);
      this.mousePressed.add(e.button);
    });

    window.addEventListener('mouseup', (e) => {
      if (this.mouseDown.delete(e.button)) this.mouseReleased.add(e.button);
    });

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    window.addEventListener(
      'wheel',
      (e) => {
        if (!this.isPointerLocked || this.touchMode) return;
        e.preventDefault();
        this.wheelDelta += Math.sign(e.deltaY);
      },
      { passive: false }
    );

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      if (locked) {
        this.touchMode = false;
        this.isPointerLocked = true;
        this.onLockChangeCallback?.(true);
      } else if (!this.touchMode) {
        this.isPointerLocked = false;
        this.clearAllInputs();
        this.onLockChangeCallback?.(false);
      }
    });
  }

  public get isTouchGameplay(): boolean {
    return this.isPointerLocked && this.touchMode;
  }

  public onPointerLockChange(cb: (locked: boolean) => void): void {
    this.onLockChangeCallback = cb;
  }

  public requestPointerLock(): void {
    const canPointerLock = typeof this.canvas.requestPointerLock === 'function';
    if (this.lastInputWasTouch || !canPointerLock || isCoarsePointerPrimary()) {
      this.enterTouchPlayMode();
      return;
    }

    try {
      const result = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      if (result && typeof result.catch === 'function') {
        result.catch(() => {
          if (isTouchDevice()) this.enterTouchPlayMode();
        });
      }
    } catch {
      this.enterTouchPlayMode();
    }
  }

  public exitPointerLock(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    if (this.touchMode && this.isPointerLocked) {
      this.isPointerLocked = false;
      this.clearAllInputs();
      this.onLockChangeCallback?.(false);
    }
  }

  public enterTouchPlayMode(): void {
    this.touchMode = true;
    this.isPointerLocked = true;
    this.onLockChangeCallback?.(true);
  }

  public setVirtualKey(code: string, down: boolean): void {
    if (down) {
      if (!this.virtualKeysDown.has(code) && !this.keysDown.has(code)) {
        this.keysPressed.add(code);
      }
      this.virtualKeysDown.add(code);
    } else {
      this.virtualKeysDown.delete(code);
    }
  }

  public triggerVirtualKeyPress(code: string): void {
    this.keysPressed.add(code);
  }

  public setVirtualMouse(button: number, down: boolean): void {
    if (down) {
      if (!this.virtualMouseDown.has(button) && !this.mouseDown.has(button)) {
        this.mousePressed.add(button);
      }
      this.virtualMouseDown.add(button);
    } else if (this.virtualMouseDown.delete(button)) {
      this.mouseReleased.add(button);
    }
  }

  public triggerVirtualMouseTap(button: number): void {
    this.mousePressed.add(button);
    this.mouseReleased.add(button);
  }

  public addLookDelta(dx: number, dy: number): void {
    this.mouseDeltaX += dx;
    this.mouseDeltaY += dy;
  }

  public setVirtualMove(strafeX: number, forwardY: number): void {
    this.virtualMoveX = Math.max(-1, Math.min(1, strafeX));
    this.virtualMoveForward = Math.max(-1, Math.min(1, forwardY));
  }

  public clearVirtualInputs(): void {
    this.virtualKeysDown.clear();
    this.virtualMouseDown.clear();
    this.virtualMoveX = 0;
    this.virtualMoveForward = 0;
  }

  public isKeyDown(code: string): boolean {
    return this.keysDown.has(code) || this.virtualKeysDown.has(code);
  }

  public isMouseDown(button: number): boolean {
    return this.mouseDown.has(button) || this.virtualMouseDown.has(button);
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

  public consumeMouseRelease(button: number): boolean {
    if (this.mouseReleased.has(button)) {
      this.mouseReleased.delete(button);
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
    this.mouseReleased.clear();
  }

  private clearAllInputs(): void {
    this.keysDown.clear();
    this.virtualKeysDown.clear();
    this.keysPressed.clear();
    this.mouseDown.clear();
    this.virtualMouseDown.clear();
    this.mousePressed.clear();
    this.mouseReleased.clear();
    this.virtualMoveX = 0;
    this.virtualMoveForward = 0;
  }
}
