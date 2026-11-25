import { TileIndex } from '../../world/Block';
import { TilePainter } from './PixelArt';

export type TileDrawer = (tile: TileIndex, painter: TilePainter) => void;
