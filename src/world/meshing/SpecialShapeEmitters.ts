import { TileIndex } from '../../content/TileIndex';
import { GeometryBuilder } from './GeometryBuilder';
import { LIGHT_CURVE } from './LightCurves';

type UVBounds = [number, number, number, number];

export interface TileUvProvider {
  getTileUVs(tile: TileIndex): UVBounds;
  getSubTileUVs(tile: TileIndex, px0: number, py0: number, px1: number, py1: number): UVBounds;
}

export function emitTorchGeometry(
  builder: GeometryBuilder,
  atlas: TileUvProvider,
  lx: number,
  y: number,
  lz: number,
  packedLight: number
): void {
  const x0 = lx + 7 / 16;
  const x1 = lx + 9 / 16;
  const z0 = lz + 7 / 16;
  const z1 = lz + 9 / 16;
  const y0 = y;
  const y1 = y + 10 / 16;

  const skyNorm = LIGHT_CURVE[(packedLight >> 4) & 0xf];
  const blkNorm = 1.0;

  // Side sub-UV: x=7..9, y=6..16 in the 16x16 Torch tile
  const [su0, sv0, su1, sv1] = atlas.getSubTileUVs(TileIndex.Torch, 7, 6, 9, 16);
  // Top ember sub-UV: x=7..9, y=6..8
  const [tu0, tv0, tu1, tv1] = atlas.getSubTileUVs(TileIndex.Torch, 7, 6, 9, 8);

  // +X
  builder.pushQuad(
    [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1],
    [1, 0, 0], su0, sv0, su1, sv1, 0.95, skyNorm, blkNorm
  );
  // -X
  builder.pushQuad(
    [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0],
    [-1, 0, 0], su0, sv0, su1, sv1, 0.95, skyNorm, blkNorm
  );
  // +Z
  builder.pushQuad(
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    [0, 0, 1], su0, sv0, su1, sv1, 0.98, skyNorm, blkNorm
  );
  // -Z
  builder.pushQuad(
    [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0],
    [0, 0, -1], su0, sv0, su1, sv1, 0.98, skyNorm, blkNorm
  );
  // +Y top ember
  builder.pushQuad(
    [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0],
    [0, 1, 0], tu0, tv0, tu1, tv1, 1.0, skyNorm, blkNorm
  );
}

export function emitCrossGeometry(
  builder: GeometryBuilder,
  atlas: TileUvProvider,
  tile: TileIndex,
  lx: number,
  y: number,
  lz: number,
  packedLight: number,
  emissive: boolean
): void {
  const pad = 0.08;
  const x0 = lx + pad;
  const x1 = lx + 1 - pad;
  const z0 = lz + pad;
  const z1 = lz + 1 - pad;
  const y0 = y;
  const y1 = y + 1;

  const skyNorm = LIGHT_CURVE[(packedLight >> 4) & 0xf];
  const blkNorm = emissive ? 1.0 : LIGHT_CURVE[packedLight & 0xf];
  const shade = emissive ? 1.0 : 0.9;

  const [u0, v0, u1, v1] = atlas.getTileUVs(tile);

  // Diagonal A (front + back so FrontSide culling renders from every angle)
  builder.pushQuad(
    [x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0],
    [0, 1, 0], u0, v0, u1, v1, shade, skyNorm, blkNorm
  );
  builder.pushQuad(
    [x1, y0, z1], [x0, y0, z0], [x0, y1, z0], [x1, y1, z1],
    [0, 1, 0], u0, v0, u1, v1, shade, skyNorm, blkNorm
  );

  // Diagonal B (front + back)
  builder.pushQuad(
    [x0, y0, z1], [x1, y0, z0], [x1, y1, z0], [x0, y1, z1],
    [0, 1, 0], u0, v0, u1, v1, shade, skyNorm, blkNorm
  );
  builder.pushQuad(
    [x1, y0, z0], [x0, y0, z1], [x0, y1, z1], [x1, y1, z0],
    [0, 1, 0], u0, v0, u1, v1, shade, skyNorm, blkNorm
  );
}
