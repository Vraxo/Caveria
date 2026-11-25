import { TileIndex } from '../../content/TileIndex';
import { TilePainter } from './PixelArt';

export type TileDrawer = (tile: TileIndex, painter: TilePainter) => void;
