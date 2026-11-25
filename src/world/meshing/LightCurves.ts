export const AO_CURVE = [0.46, 0.66, 0.84, 1] as const;
export const LIGHT_CURVE = Array.from({ length: 16 }, (_, level) => Math.pow(level / 15, 1.85));

export function sampleLightCurve(level: number): number {
  const clamped = Math.max(0, Math.min(15, level));
  const low = Math.floor(clamped);
  const high = Math.min(15, low + 1);
  const fraction = clamped - low;
  return LIGHT_CURVE[low] * (1 - fraction) + LIGHT_CURVE[high] * fraction;
}
