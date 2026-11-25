export type RGBA = [red: number, green: number, blue: number, alpha: number];
export type RGB = [red: number, green: number, blue: number];
export type PixelWriter = (x: number, y: number, color: RGBA) => void;
export type TilePainter = (pixel: PixelWriter, random: () => number) => void;

export function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function varyColor(base: RGB, delta: number, alpha = 255): RGBA {
  return [
    clampByte(base[0] + delta),
    clampByte(base[1] + delta),
    clampByte(base[2] + delta),
    alpha,
  ];
}

export function createCanvas2D(
  width: number,
  height: number,
  purpose: string
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error(`Failed to acquire 2D canvas context for ${purpose}`);
  return { canvas, context };
}
