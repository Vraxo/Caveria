import { Game } from './core/Game';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
if (!canvas) {
  throw new Error('Canvas #game-canvas not found');
}

const game = new Game(canvas);
game.start();
