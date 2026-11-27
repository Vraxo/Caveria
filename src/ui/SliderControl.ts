/**
 * A range slider with a label, a value display, and optional end labels.
 * Values move freely between min and max; with `snapTo` set, the value snaps to
 * the closest snap point when it is within `snapTolerance` of it.
 */

export interface SliderControlOptions {
  min: number;
  max: number;
  /** Slider step (values between steps still move the slider, where supported). */
  step?: number;
  /** Initial value (defaults to `min`). */
  value?: number;
  /** Label above the slider. */
  label?: string;
  /** Labels rendered at both ends of the slider track. */
  endLabels?: { min: string; max: string };
  /** Snap points the slider value can snap to (empty means no snapping). */
  snapTo?: readonly number[];
  snapTolerance?: number;
  onValueChange: (value: number) => void;
}

/** Returns `value` snapped to the closest entry of `snapTo` within `tolerance`; otherwise `value`. */
export function snapValue(value: number, snapTo: readonly number[], tolerance: number): number {
  let best = value;
  let bestDistance = tolerance;
  for (const candidate of snapTo) {
    const distance = Math.abs(value - candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

export class SliderControl {
  public static mount(
    parent: HTMLElement,
    options: SliderControlOptions
  ): SliderControl {
    const control = new SliderControl(parent.ownerDocument!.createElement('div'), options);
    parent.appendChild(control.root);
    return control;
  }

  public readonly root: HTMLElement;
  public readonly input: HTMLInputElement;
  private readonly labelEl: HTMLElement;
  private readonly valueEl: HTMLElement;
  private readonly trackEl: HTMLElement;
  private readonly onValueChange: (value: number) => void;
  private readonly minValue: number;
  private readonly maxValue: number;
  private snapTo: readonly number[] = [];
  private snapTolerance = 0;

  constructor(root: HTMLElement, options: SliderControlOptions) {
    const doc = root.ownerDocument!;
    this.root = root;
    this.root.className = 'voxel-slider';
    this.onValueChange = options.onValueChange;
    this.minValue = options.min;
    this.maxValue = options.max;
    this.snapTo = options.snapTo ?? [];
    this.snapTolerance = options.snapTolerance ?? 0;

    this.labelEl = doc.createElement('span');
    this.labelEl.className = 'voxel-slider__label';
    this.labelEl.textContent = options.label ?? '';

    this.trackEl = doc.createElement('span');
    this.trackEl.className = 'voxel-slider__track';
    if (options.endLabels) {
      const minLabel = doc.createElement('span');
      minLabel.className = 'voxel-slider__end';
      minLabel.dataset.end = 'min';
      minLabel.textContent = options.endLabels.min;
      this.trackEl.appendChild(minLabel);
    }
    this.input = doc.createElement('input');
    this.input.type = 'range';
    this.input.className = 'voxel-slider__input';
    this.input.min = String(options.min);
    this.input.max = String(options.max);
    this.input.step = String(options.step ?? 1);
    this.trackEl.appendChild(this.input);
    if (options.endLabels) {
      const maxLabel = doc.createElement('span');
      maxLabel.className = 'voxel-slider__end';
      maxLabel.dataset.end = 'max';
      maxLabel.textContent = options.endLabels.max;
      this.trackEl.appendChild(maxLabel);
    }

    this.valueEl = doc.createElement('span');
    this.valueEl.className = 'voxel-slider__value';

    this.root.appendChild(this.labelEl);
    this.root.appendChild(this.trackEl);
    this.root.appendChild(this.valueEl);

    this.setValue(options.value ?? options.min);
    this.input.addEventListener('input', () => this.applyValue(this.input.valueAsNumber));
  }

  public get value(): number {
    const parsed = this.input.valueAsNumber;
    return Number.isFinite(parsed) ? parsed : this.minValue;
  }

  /** Updates the value display and input without firing `onValueChange`. */
  public setValue(value: number): void {
    this.input.value = String(this.clamp(value));
    this.valueEl.textContent = this.formatValue(this.value);
  }

  /** Updates snapping; snaps the current value. */
  public setSnapTo(snapTo: readonly number[], tolerance: number): void {
    this.snapTo = snapTo;
    this.snapTolerance = tolerance;
    this.setValue(this.value);
  }

  public setLabel(label: string): void {
    this.labelEl.textContent = label;
  }

  private applyValue(raw: number): void {
    const clamped = this.clamp(raw);
    this.input.value = String(clamped);
    this.valueEl.textContent = this.formatValue(clamped);
    this.onValueChange(clamped);
  }

  private clamp(value: number): number {
    const snapped = snapValue(value, this.snapTo, this.snapTolerance);
    return Math.min(this.maxValue, Math.max(this.minValue, snapped));
  }

  private formatValue(value: number): string {
    const rounded = Math.round(value * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : String(Math.round(value));
  }
}
