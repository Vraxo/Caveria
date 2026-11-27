export type TouchSlotMode = 'all' | 'one' | 'quick';

const MODE_ORDER: readonly TouchSlotMode[] = ['all', 'one', 'quick'];
const MODE_LABELS: Record<TouchSlotMode, string> = {
  all: 'Tap: All',
  one: 'Tap: 1 / Half',
  quick: 'Tap: Quick',
};

let currentTouchMode: TouchSlotMode = 'all';
const listeners = new Set<(mode: TouchSlotMode) => void>();

export function getTouchSlotMode(): TouchSlotMode {
  return currentTouchMode;
}

export function cycleTouchSlotMode(): TouchSlotMode {
  const nextIndex = (MODE_ORDER.indexOf(currentTouchMode) + 1) % MODE_ORDER.length;
  currentTouchMode = MODE_ORDER[nextIndex];
  for (const listener of listeners) listener(currentTouchMode);
  return currentTouchMode;
}

/** Binds a compact modal header button that cycles tap behavior on touch screens. */
export function bindTouchSlotModeButton(button: HTMLButtonElement | null): void {
  if (!button) return;
  const sync = (mode: TouchSlotMode): void => {
    button.textContent = MODE_LABELS[mode];
    button.dataset.mode = mode;
  };
  sync(currentTouchMode);
  listeners.add(sync);
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    cycleTouchSlotMode();
  });
}

/** Resolves mouse or touch pointerdown into the equivalent desktop button + shiftKey action. */
export function resolveSlotPointerAction(event: PointerEvent): {
  button: number;
  shiftKey: boolean;
} {
  if (event.pointerType !== 'touch') {
    return { button: event.button, shiftKey: event.shiftKey };
  }
  if (currentTouchMode === 'one') return { button: 2, shiftKey: false };
  if (currentTouchMode === 'quick') return { button: 0, shiftKey: true };
  return { button: 0, shiftKey: false };
}

/** Positions the floating held-stack cursor cleanly for both mouse hover and touch taps. */
export function positionCursorStack(cursorEl: HTMLElement, event: PointerEvent): void {
  const offsetY = event.pointerType === 'touch' ? -36 : 0;
  cursorEl.style.left = `${event.clientX}px`;
  cursorEl.style.top = `${Math.max(28, event.clientY + offsetY)}px`;
}
