import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../../src/core/Input';
import {
  cycleTouchSlotMode,
  getTouchSlotMode,
  resolveSlotPointerAction,
} from '../../src/ui/ModalPointerMode';

function stubDomEnv(): {
  canvas: HTMLElement;
  listeners: Map<string, Array<(e: unknown) => void>>;
} {
  const listeners = new Map<string, Array<(e: unknown) => void>>();
  const addListener = (type: string, fn: (e: unknown) => void): void => {
    const list = listeners.get(type) ?? [];
    list.push(fn);
    listeners.set(type, list);
  };

  vi.stubGlobal('window', {
    addEventListener: addListener,
    matchMedia: () => ({ matches: false }),
  });
  vi.stubGlobal('document', {
    pointerLockElement: null,
    addEventListener: addListener,
    exitPointerLock: vi.fn(),
  });

  // Canvas without requestPointerLock (mirrors mobile browsers like iOS Safari).
  const canvas = {} as HTMLElement;
  return { canvas, listeners };
}

describe('Input mobile touch mode', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to touch play mode when requestPointerLock is unavailable', () => {
    const { canvas } = stubDomEnv();
    const input = new Input(canvas);
    const lockEvents: boolean[] = [];
    input.onPointerLockChange((locked) => lockEvents.push(locked));

    input.requestPointerLock();
    expect(input.isPointerLocked).toBe(true);
    expect(input.isTouchGameplay).toBe(true);
    expect(lockEvents).toEqual([true]);

    input.setVirtualMove(0.5, 0.9);
    input.setVirtualKey('Space', true);
    input.setVirtualMouse(0, true);
    input.addLookDelta(14, -6);

    expect(input.virtualMoveX).toBe(0.5);
    expect(input.virtualMoveForward).toBe(0.9);
    expect(input.isKeyDown('Space')).toBe(true);
    expect(input.consumeKeyPress('Space')).toBe(true);
    expect(input.isMouseDown(0)).toBe(true);
    expect(input.consumeMousePress(0)).toBe(true);
    expect(input.mouseDeltaX).toBe(14);
    expect(input.mouseDeltaY).toBe(-6);

    input.exitPointerLock();
    expect(input.isPointerLocked).toBe(false);
    expect(input.isKeyDown('Space')).toBe(false);
    expect(input.isMouseDown(0)).toBe(false);
    expect(input.virtualMoveForward).toBe(0);
    expect(lockEvents).toEqual([true, false]);
  });

  it('cycles touch modal tap modes while preserving desktop mouse buttons', () => {
    const mouseRight = resolveSlotPointerAction({
      pointerType: 'mouse',
      button: 2,
      shiftKey: false,
    } as PointerEvent);
    expect(mouseRight).toEqual({ button: 2, shiftKey: false });

    while (getTouchSlotMode() !== 'all') cycleTouchSlotMode();
    expect(
      resolveSlotPointerAction({ pointerType: 'touch', button: 0, shiftKey: false } as PointerEvent)
    ).toEqual({ button: 0, shiftKey: false });

    expect(cycleTouchSlotMode()).toBe('one');
    expect(
      resolveSlotPointerAction({ pointerType: 'touch', button: 0, shiftKey: false } as PointerEvent)
    ).toEqual({ button: 2, shiftKey: false });

    expect(cycleTouchSlotMode()).toBe('quick');
    expect(
      resolveSlotPointerAction({ pointerType: 'touch', button: 0, shiftKey: false } as PointerEvent)
    ).toEqual({ button: 0, shiftKey: true });

    expect(cycleTouchSlotMode()).toBe('all');
  });
});
