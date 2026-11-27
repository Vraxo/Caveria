import { Input } from '../core/Input';

const JOYSTICK_DEADZONE = 0.14;
const JOYSTICK_SPRINT_THRESHOLD = 0.86;
const TOUCH_LOOK_SENSITIVITY = 1.65;
const QUICK_TAP_MAX_MS = 220;
const QUICK_TAP_MAX_MOVE_PX = 12;

export interface TouchControlsDependencies {
  canvas: HTMLElement;
  input: Input;
  onPause: () => void;
  onInventory: () => void;
  onDrop: () => void;
  onToggleFly: () => void;
}

/**
 * Multi-touch mobile HUD controller: left analog thumbstick, open-canvas camera look
 * (+ short-tap use), right-side Mine/Use/Jump/Sneak buttons, and top utility buttons.
 */
export class TouchControls {
  private readonly rootEl = document.getElementById('touch-controls');
  private readonly joystickEl = document.getElementById('touch-joystick');
  private readonly knobEl = document.getElementById('touch-joystick-knob');
  private readonly mineBtn = document.getElementById('touch-mine-btn') as HTMLButtonElement | null;
  private readonly useBtn = document.getElementById('touch-use-btn') as HTMLButtonElement | null;
  private readonly jumpBtn = document.getElementById('touch-jump-btn') as HTMLButtonElement | null;
  private readonly sneakBtn = document.getElementById('touch-sneak-btn') as HTMLButtonElement | null;
  private readonly pauseBtn = document.getElementById('touch-pause-btn') as HTMLButtonElement | null;
  private readonly invBtn = document.getElementById('touch-inv-btn') as HTMLButtonElement | null;
  private readonly dropBtn = document.getElementById('touch-drop-btn') as HTMLButtonElement | null;
  private readonly flyBtn = document.getElementById('touch-fly-btn') as HTMLButtonElement | null;

  private readonly canvas: HTMLElement;
  private readonly input: Input;
  private readonly onPause: () => void;
  private readonly onInventory: () => void;
  private readonly onDrop: () => void;
  private readonly onToggleFly: () => void;

  private visible = false;
  private joystickPointerId: number | null = null;
  private joystickCenterX = 0;
  private joystickCenterY = 0;
  private joystickMaxRadius = 42;

  private lookPointerId: number | null = null;
  private lookLastX = 0;
  private lookLastY = 0;
  private lookStartTime = 0;
  private lookTotalMove = 0;

  private sneakToggled = false;
  private flyMode = false;
  private riding = false;

  constructor(deps: TouchControlsDependencies) {
    this.canvas = deps.canvas;
    this.input = deps.input;
    this.onPause = deps.onPause;
    this.onInventory = deps.onInventory;
    this.onDrop = deps.onDrop;
    this.onToggleFly = deps.onToggleFly;

    this.bindJoystick();
    this.bindCanvasLook();
    this.bindActionButtons();
    this.bindTopBar();

    window.addEventListener('blur', () => this.resetAll());
  }

  public setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.rootEl?.classList.toggle('hidden', !visible);
    document.body.classList.toggle('touch-controls-active', visible);
    if (!visible) this.resetAll();
  }

  /** Keeps button labels aligned with current fly / crouch / riding state. */
  public syncPlayerState(flyMode: boolean, crouching: boolean, riding: boolean): void {
    this.flyMode = flyMode;
    this.riding = riding;
    if (this.flyBtn) {
      this.flyBtn.classList.toggle('active', flyMode);
      this.flyBtn.textContent = flyMode ? 'FLY: ON' : 'FLY';
    }
    if (this.sneakBtn) {
      if (riding) {
        this.sneakBtn.textContent = 'DISMT';
        this.sneakBtn.classList.remove('active');
      } else if (flyMode) {
        this.sneakBtn.textContent = 'DOWN';
        this.sneakBtn.classList.toggle('active', this.input.isKeyDown('ShiftLeft'));
      } else {
        this.sneakBtn.textContent = 'SNEAK';
        this.sneakBtn.classList.toggle('active', this.sneakToggled || crouching);
      }
    }
  }

  private resetAll(): void {
    this.joystickPointerId = null;
    this.lookPointerId = null;
    this.sneakToggled = false;
    this.setKnobVisual(0, 0);
    this.input.clearVirtualInputs();
    this.mineBtn?.classList.remove('active');
    this.useBtn?.classList.remove('active');
    this.jumpBtn?.classList.remove('active');
    this.sneakBtn?.classList.remove('active');
  }

  private bindJoystick(): void {
    const pad = this.joystickEl;
    if (!pad) return;

    const updateStick = (clientX: number, clientY: number): void => {
      const dx = clientX - this.joystickCenterX;
      const dy = clientY - this.joystickCenterY;
      const dist = Math.hypot(dx, dy);
      const radius = this.joystickMaxRadius;
      const clampedDist = Math.min(dist, radius);
      const angle = Math.atan2(dy, dx);
      const clampedX = Math.cos(angle) * clampedDist;
      const clampedY = Math.sin(angle) * clampedDist;
      this.setKnobVisual(clampedX, clampedY);

      const norm = clampedDist / radius;
      if (norm < JOYSTICK_DEADZONE) {
        this.input.setVirtualMove(0, 0);
        this.input.setVirtualKey('ControlLeft', false);
        return;
      }

      const scaled = (norm - JOYSTICK_DEADZONE) / (1 - JOYSTICK_DEADZONE);
      const strafe = (clampedX / clampedDist) * scaled;
      const forward = (-clampedY / clampedDist) * scaled;
      this.input.setVirtualMove(strafe, forward);
      // Auto-sprint when pushing the thumbstick all the way forward.
      this.input.setVirtualKey(
        'ControlLeft',
        forward >= JOYSTICK_SPRINT_THRESHOLD && Math.abs(strafe) < 0.48
      );
    };

    pad.addEventListener('pointerdown', (event) => {
      if (!this.visible || this.joystickPointerId !== null) return;
      event.preventDefault();
      event.stopPropagation();
      this.joystickPointerId = event.pointerId;
      pad.setPointerCapture?.(event.pointerId);
      const rect = pad.getBoundingClientRect();
      this.joystickCenterX = rect.left + rect.width / 2;
      this.joystickCenterY = rect.top + rect.height / 2;
      this.joystickMaxRadius = Math.max(28, rect.width * 0.36);
      updateStick(event.clientX, event.clientY);
    });

    pad.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.joystickPointerId) return;
      event.preventDefault();
      updateStick(event.clientX, event.clientY);
    });

    const releaseStick = (event: PointerEvent): void => {
      if (event.pointerId !== this.joystickPointerId) return;
      this.joystickPointerId = null;
      this.setKnobVisual(0, 0);
      this.input.setVirtualMove(0, 0);
      this.input.setVirtualKey('ControlLeft', false);
    };

    pad.addEventListener('pointerup', releaseStick);
    pad.addEventListener('pointercancel', releaseStick);
  }

  private setKnobVisual(offsetX: number, offsetY: number): void {
    if (!this.knobEl) return;
    this.knobEl.style.transform = `translate3d(${offsetX.toFixed(1)}px, ${offsetY.toFixed(1)}px, 0)`;
  }

  private bindCanvasLook(): void {
    this.canvas.addEventListener('pointerdown', (event) => {
      if (!this.visible || event.pointerType !== 'touch') return;
      if (this.lookPointerId !== null) return;
      event.preventDefault();
      this.lookPointerId = event.pointerId;
      this.lookLastX = event.clientX;
      this.lookLastY = event.clientY;
      this.lookStartTime = performance.now();
      this.lookTotalMove = 0;
      this.canvas.setPointerCapture?.(event.pointerId);
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.lookPointerId) return;
      event.preventDefault();
      const dx = event.clientX - this.lookLastX;
      const dy = event.clientY - this.lookLastY;
      this.lookLastX = event.clientX;
      this.lookLastY = event.clientY;
      this.lookTotalMove += Math.hypot(dx, dy);
      this.input.addLookDelta(dx * TOUCH_LOOK_SENSITIVITY, dy * TOUCH_LOOK_SENSITIVITY);
    });

    const endLook = (event: PointerEvent): void => {
      if (event.pointerId !== this.lookPointerId) return;
      this.lookPointerId = null;
      const elapsed = performance.now() - this.lookStartTime;
      // Short crisp tap on open viewport triggers Use / Place block / Interact.
      if (elapsed <= QUICK_TAP_MAX_MS && this.lookTotalMove <= QUICK_TAP_MAX_MOVE_PX) {
        this.input.triggerVirtualMouseTap(2);
      }
    };

    this.canvas.addEventListener('pointerup', endLook);
    this.canvas.addEventListener('pointercancel', () => {
      this.lookPointerId = null;
    });
  }

  private bindHoldButton(
    button: HTMLButtonElement | null,
    onChange: (down: boolean) => void
  ): void {
    if (!button) return;
    let activePointerId: number | null = null;

    button.addEventListener('pointerdown', (event) => {
      if (!this.visible || activePointerId !== null) return;
      event.preventDefault();
      event.stopPropagation();
      activePointerId = event.pointerId;
      button.setPointerCapture?.(event.pointerId);
      button.classList.add('active');
      onChange(true);
    });

    const release = (event: PointerEvent): void => {
      if (event.pointerId !== activePointerId) return;
      activePointerId = null;
      button.classList.remove('active');
      onChange(false);
    };

    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
  }

  private bindActionButtons(): void {
    this.bindHoldButton(this.mineBtn, (down) => this.input.setVirtualMouse(0, down));
    this.bindHoldButton(this.useBtn, (down) => this.input.setVirtualMouse(2, down));
    this.bindHoldButton(this.jumpBtn, (down) => this.input.setVirtualKey('Space', down));

    // Sneak button: toggle crouch while walking, hold descent while flying, tap to dismount camel.
    if (this.sneakBtn) {
      let flyPointerId: number | null = null;
      this.sneakBtn.addEventListener('pointerdown', (event) => {
        if (!this.visible) return;
        event.preventDefault();
        event.stopPropagation();
        if (this.riding) {
          this.input.triggerVirtualKeyPress('ShiftLeft');
          return;
        }
        if (this.flyMode) {
          flyPointerId = event.pointerId;
          this.sneakBtn!.setPointerCapture?.(event.pointerId);
          this.sneakBtn!.classList.add('active');
          this.input.setVirtualKey('ShiftLeft', true);
          return;
        }
        this.sneakToggled = !this.sneakToggled;
        this.sneakBtn!.classList.toggle('active', this.sneakToggled);
        this.input.setVirtualKey('ShiftLeft', this.sneakToggled);
      });

      const releaseFlyDown = (event: PointerEvent): void => {
        if (event.pointerId !== flyPointerId) return;
        flyPointerId = null;
        this.sneakBtn!.classList.remove('active');
        this.input.setVirtualKey('ShiftLeft', false);
      };
      this.sneakBtn.addEventListener('pointerup', releaseFlyDown);
      this.sneakBtn.addEventListener('pointercancel', releaseFlyDown);
    }
  }

  private bindTopBar(): void {
    const bindTap = (button: HTMLButtonElement | null, action: () => void): void => {
      if (!button) return;
      button.addEventListener('pointerdown', (event) => {
        if (!this.visible) return;
        event.preventDefault();
        event.stopPropagation();
        action();
      });
    };

    bindTap(this.pauseBtn, () => this.onPause());
    bindTap(this.invBtn, () => this.onInventory());
    bindTap(this.dropBtn, () => this.onDrop());
    bindTap(this.flyBtn, () => {
      this.sneakToggled = false;
      this.input.setVirtualKey('ShiftLeft', false);
      this.onToggleFly();
    });
  }
}
