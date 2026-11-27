import { Game } from './core/Game';
import {
  loadTexturePackManifest,
  loadTexturePackTiles,
  resolveTexturePack,
} from './rendering/textures/TexturePacks';
import { readSettings } from './settings/GameSettings';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error('Canvas #game-canvas not found');
}
const gameCanvas = canvas;

async function boot(): Promise<void> {
  let instance: Game | null = null;
  // Expose the Game instance so devtools can call game.atlas.downloadTiles() or game.setTexturePack().
  // The property exists from the start; `instance` is set once the game is constructed.
  Object.defineProperty(window, 'game', { configurable: true, get: () => instance });

  const texturePacks = await loadTexturePackManifest();
  const activePack = resolveTexturePack(texturePacks, readSettings().texturePack);
  const loadedTiles = await loadTexturePackTiles(activePack);
  const game = new Game(gameCanvas, loadedTiles, texturePacks, activePack.id);
  instance = game;
  game.start();
}

void boot();
