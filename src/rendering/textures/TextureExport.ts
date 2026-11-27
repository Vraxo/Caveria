import { TileIndex } from '../../content/TileIndex';
import { tileFilename } from './TextureLoad';

/**
 * Exports generated tile canvases as downloadable PNG files so users can pick the
 * good ones and commit them to `public/generated-textures/tiles/`.
 */

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas produced no PNG blob'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

export async function downloadTileCanvas(
  canvas: HTMLCanvasElement,
  filename: string
): Promise<void> {
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke after a delay so browsers have time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export async function exportTiles(
  tileCanvases: ReadonlyMap<TileIndex, HTMLCanvasElement>
): Promise<void> {
  for (const [tile, canvas] of tileCanvases) {
    await downloadTileCanvas(canvas, tileFilename(tile));
  }
}
