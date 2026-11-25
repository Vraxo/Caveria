export enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Cobblestone = 4,
  Sand = 5,
  OakLog = 6,
  OakLeaves = 7,
  OakPlanks = 8,
  CoalOre = 9,
  GoldOre = 10,
  Glass = 11,
  Water = 12,
  Bedrock = 13,
  Torch = 14,
  GlowCrystal = 15,
}

export enum TileIndex {
  GrassTop = 0,
  GrassSide = 1,
  Dirt = 2,
  Stone = 3,
  Cobblestone = 4,
  Sand = 5,
  OakLogSide = 6,
  OakLogTop = 7,
  OakLeaves = 8,
  OakPlanks = 9,
  CoalOre = 10,
  GoldOre = 11,
  Glass = 12,
  Water = 13,
  Bedrock = 14,
  Torch = 15,
  GlowCrystal = 16,
}

export type BlockRenderShape = 'cube' | 'torch';

export interface BlockDefinition {
  id: BlockId;
  name: string;
  /** Blocks player movement AABB */
  solid: boolean;
  /** Raycast can target this block */
  targetable: boolean;
  /** True if adjacent solid blocks must still render their shared face */
  transparent: boolean;
  /** True if rendered in translucent pass (water) */
  liquid: boolean;
  /** True if player can break it */
  breakable: boolean;
  /** Emitted block light level (0..15) */
  lightEmission: number;
  /** Extra skylight attenuation when passing through (0 for air/glass, 1 for leaves, 2 for water, 15 for opaque) */
  lightOpacity: number;
  /** Render geometry style */
  shape: BlockRenderShape;
  /** Tile indices per face: [px, nx, py, ny, pz, nz] */
  faces: [TileIndex, TileIndex, TileIndex, TileIndex, TileIndex, TileIndex];
}

function allFaces(t: TileIndex): [TileIndex, TileIndex, TileIndex, TileIndex, TileIndex, TileIndex] {
  return [t, t, t, t, t, t];
}

export const BLOCKS: Record<BlockId, BlockDefinition> = {
  [BlockId.Air]: {
    id: BlockId.Air,
    name: 'Air',
    solid: false,
    targetable: false,
    transparent: true,
    liquid: false,
    breakable: false,
    lightEmission: 0,
    lightOpacity: 0,
    shape: 'cube',
    faces: allFaces(TileIndex.Dirt),
  },
  [BlockId.Grass]: {
    id: BlockId.Grass,
    name: 'Grass Block',
    solid: true,
    targetable: true,
    transparent: false,
    liquid: false,
    breakable: true,
    lightEmission: 0,
    lightOpacity: 15,
    shape: 'cube',
    faces: [
      TileIndex.GrassSide,
      TileIndex.GrassSide,
      TileIndex.GrassTop,
      TileIndex.Dirt,
      TileIndex.GrassSide,
      TileIndex.GrassSide,
    ],
  },
  [BlockId.Dirt]: {
    id: BlockId.Dirt,
    name: 'Dirt',
    solid: true,
    targetable: true,
    transparent: false,
    liquid: false,
    breakable: true,
    lightEmission: 0,
    lightOpacity: 15,
    shape: 'cube',
    faces: allFaces(TileIndex.Dirt),
  },
  [BlockId.Stone]: {
    id: BlockId.Stone,
    name: 'Stone',
    solid: true,
    targetable: true,
    transparent: false,
    liquid: false,
    breakable: true,
    lightEmission: 0,
    lightOpacity: 15,
    shape: 'cube',
    faces: allFaces(TileIndex.Stone),
  },
  [BlockId.Cobblestone]: {
    id: BlockId.Cobblestone,
    name: 'Cobblestone',
    solid: true,
    targetable: true,
    transparent: false,
    liquid: false,
    breakable: true,
    lightEmission: 0,
    lightOpacity: 15,
    shape: 'cube',
    faces: allFaces(TileIndex.Cobblestone),
  },
  [BlockId.Sand]: {
    id: BlockId.Sand,
    name: 'Sand',
    solid: true,
    targetable: true,
    transparent: false,
    liquid: false,
    breakable: true,
    lightEmission: 0,
    lightOpacity: 15,
    shape: 'cube',
    faces: allFaces(TileIndex.Sand),
  },
  [BlockId.OakLog]: {
    id: BlockId.OakLog,
    name: 'Oak Log',
    solid: true,
    targetable: true,
    transparent: false,
    liquid: false,
    breakable: true,
    lightEmission: 0,
    lightOpacity: 15,
    shape: 'cube',
    faces: [
      TileIndex.OakLogSide,
      TileIndex.OakLogSide,
      TileIndex.OakLogTop,
      TileIndex.OakLogTop,
      TileIndex.OakLogSide,
      TileIndex.OakLogSide,
    ],
  },
  [BlockId.OakLeaves]: {
    id: BlockId.OakLeaves,
    name: 'Oak Leaves',
    solid: true,
    targetable: true,
    transparent: true,
    liquid: false,
    breakable: true,
    lightEmission: 0,
    lightOpacity: 1,
    shape: 'cube',
    faces: allFaces(TileIndex.OakLeaves),
  },
  [BlockId.OakPlanks]: {
    id: BlockId.OakPlanks,
    name: 'Oak Planks',
    solid: true,
    targetable: true,
    transparent: false,
    liquid: false,
    breakable: true,
    lightEmission: 0,
    lightOpacity: 15,
    shape: 'cube',
    faces: allFaces(TileIndex.OakPlanks),
  },
  [BlockId.CoalOre]: {
    id: BlockId.CoalOre,
    name: 'Coal Ore',
    solid: true,
    targetable: true,
    transparent: false,
    liquid: false,
    breakable: true,
    lightEmission: 0,
    lightOpacity: 15,
    shape: 'cube',
    faces: allFaces(TileIndex.CoalOre),
  },
  [BlockId.GoldOre]: {
    id: BlockId.GoldOre,
    name: 'Gold Ore',
    solid: true,
    targetable: true,
    transparent: false,
    liquid: false,
    breakable: true,
    lightEmission: 0,
    lightOpacity: 15,
    shape: 'cube',
    faces: allFaces(TileIndex.GoldOre),
  },
  [BlockId.Glass]: {
    id: BlockId.Glass,
    name: 'Glass',
    solid: true,
    targetable: true,
    transparent: true,
    liquid: false,
    breakable: true,
    lightEmission: 0,
    lightOpacity: 0,
    shape: 'cube',
    faces: allFaces(TileIndex.Glass),
  },
  [BlockId.Water]: {
    id: BlockId.Water,
    name: 'Water',
    solid: false,
    targetable: false,
    transparent: true,
    liquid: true,
    breakable: false,
    lightEmission: 0,
    lightOpacity: 2,
    shape: 'cube',
    faces: allFaces(TileIndex.Water),
  },
  [BlockId.Bedrock]: {
    id: BlockId.Bedrock,
    name: 'Bedrock',
    solid: true,
    targetable: true,
    transparent: false,
    liquid: false,
    breakable: false,
    lightEmission: 0,
    lightOpacity: 15,
    shape: 'cube',
    faces: allFaces(TileIndex.Bedrock),
  },
  [BlockId.Torch]: {
    id: BlockId.Torch,
    name: 'Torch',
    solid: false,
    targetable: true,
    transparent: true,
    liquid: false,
    breakable: true,
    lightEmission: 14,
    lightOpacity: 0,
    shape: 'torch',
    faces: allFaces(TileIndex.Torch),
  },
  [BlockId.GlowCrystal]: {
    id: BlockId.GlowCrystal,
    name: 'Cavern Crystal',
    solid: true,
    targetable: true,
    transparent: false,
    liquid: false,
    breakable: true,
    lightEmission: 15,
    lightOpacity: 15,
    shape: 'cube',
    faces: allFaces(TileIndex.GlowCrystal),
  },
};

export const HOTBAR_BLOCKS: BlockId[] = [
  BlockId.Grass,
  BlockId.Cobblestone,
  BlockId.OakPlanks,
  BlockId.OakLog,
  BlockId.Torch,
  BlockId.GlowCrystal,
  BlockId.Stone,
  BlockId.Sand,
  BlockId.Glass,
];

export function isBlockSolid(id: BlockId): boolean {
  return BLOCKS[id]?.solid ?? false;
}

export function isBlockOpaque(id: BlockId): boolean {
  const def = BLOCKS[id];
  return def ? def.solid && !def.transparent && def.shape === 'cube' : false;
}
