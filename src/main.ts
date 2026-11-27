import { Game } from './core/Game';
import { loadTileCanvases } from './rendering/textures/TextureLoad';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error('Canvas #game-canvas not found');
}
const gameCanvas = canvas;

async function boot(): Promise<void> {
  // Load block tile PNGs from generated-textures/tiles when the user has placed
  // them there; otherwise the map is empty and procedural generation proceeds.
  const loadedTiles = await loadTileCanvases();
  const game = new Game(gameCanvas, loadedTiles);
  // Expose the instance so devtools can call game.atlas.downloadTiles().
  Object.assign(window, { game });
  game.start();
}

void boot();
