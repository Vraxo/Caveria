import { Game } from './core/Game';
import { loadTileCanvases } from './rendering/textures/TextureLoad';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error('Canvas #game-canvas not found');
}
const gameCanvas = canvas;

async function boot(): Promise<void> {
  let instance: Game | null = null;
  // Expose the Game instance so devtools can call game.atlas.downloadTiles().
  // The property exists from the start; `instance` is set once the game is constructed.
  Object.defineProperty(window, 'game', { configurable: true, get: () => instance });

  // Load block tile PNGs from generated-textures/tiles when the user has placed
  // them there; otherwise the map is empty and procedural generation proceeds.
  const loadedTiles = await loadTileCanvases();
  const game = new Game(gameCanvas, loadedTiles);
  instance = game;
  game.start();
}

void boot();
