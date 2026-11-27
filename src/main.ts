import { Game } from './core/Game';
import {
  loadTexturePackManifest,
  loadTexturePackTiles,
  resolveTexturePack,
} from './rendering/textures/TexturePacks';
import { readSettings } from './settings/GameSettings';
import { LoadingScreen } from './ui/LoadingScreen';

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

  const loadingScreen = new LoadingScreen();
  loadingScreen.show('Loading texture packs...', 0.04);

  const texturePacks = await loadTexturePackManifest();
  const activePack = resolveTexturePack(texturePacks, readSettings().texturePack);
  loadingScreen.setProgress(0.1, `Loading ${activePack.name} textures...`);

  const loadedTiles = await loadTexturePackTiles(activePack);
  loadingScreen.setProgress(0.2, 'Initializing world...');

  const game = new Game(
    gameCanvas,
    loadedTiles,
    texturePacks,
    activePack.id,
    true,
    loadingScreen
  );
  instance = game;

  await game.initializeWorld((fraction, status) => {
    loadingScreen.setProgress(0.2 + fraction * 0.78, status);
  });

  game.start();
  loadingScreen.hide();
}

void boot();
