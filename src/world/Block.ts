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
}

export interface BlockDefinition {
  id: BlockId;
  name: string;
  solid: boolean;
  /** True if adjacent solid blocks must still render their shared face */
  transparent: boolean;
  /** True if rendered in translucent pass (water) */
  liquid: boolean;
  /** True if player can break it */
  breakable: boolean;
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
    transparent: true,
    liquid: false,
    breakable: false,
    faces: allFaces(TileIndex.Dirt),
  },
  [BlockId.Grass]: {
    id: BlockId.Grass,
    name: 'Grass Block',
    solid: true,
    transparent: false,
    liquid: false,
    breakable: true,
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
    transparent: false,
    liquid: false,
    breakable: true,
    faces: allFaces(TileIndex.Dirt),
  },
  [BlockId.Stone]: {
    id: BlockId.Stone,
    name: 'Stone',
    solid: true,
    transparent: false,
    liquid: false,
    breakable: true,
    faces: allFaces(TileIndex.Stone),
  },
  [BlockId.Cobblestone]: {
    id: BlockId.Cobblestone,
    name: 'Cobblestone',
    solid: true,
    transparent: false,
    liquid: false,
    breakable: true,
    faces: allFaces(TileIndex.Cobblestone),
  },
  [BlockId.Sand]: {
    id: BlockId.Sand,
    name: 'Sand',
    solid: true,
    transparent: false,
    liquid: false,
    breakable: true,
    faces: allFaces(TileIndex.Sand),
  },
  [BlockId.OakLog]: {
    id: BlockId.OakLog,
    name: 'Oak Log',
    solid: true,
    transparent: false,
    liquid: false,
    breakable: true,
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
    transparent: true,
    liquid: false,
    breakable: true,
    faces: allFaces(TileIndex.OakLeaves),
  },
  [BlockId.OakPlanks]: {
    id: BlockId.OakPlanks,
    name: 'Oak Planks',
    solid: true,
    transparent: false,
    liquid: false,
    breakable: true,
    faces: allFaces(TileIndex.OakPlanks),
  },
  [BlockId.CoalOre]: {
    id: BlockId.CoalOre,
    name: 'Coal Ore',
    solid: true,
    transparent: false,
    liquid: false,
    breakable: true,
    faces: allFaces(TileIndex.CoalOre),
  },
  [BlockId.GoldOre]: {
    id: BlockId.GoldOre,
    name: 'Gold Ore',
    solid: true,
    transparent: false,
    liquid: false,
    breakable: true,
    faces: allFaces(TileIndex.GoldOre),
  },
  [BlockId.Glass]: {
    id: BlockId.Glass,
    name: 'Glass',
    solid: true,
    transparent: true,
    liquid: false,
    breakable: true,
    faces: allFaces(TileIndex.Glass),
  },
  [BlockId.Water]: {
    id: BlockId.Water,
    name: 'Water',
    solid: false,
    transparent: true,
    liquid: true,
    breakable: false,
    faces: allFaces(TileIndex.Water),
  },
  [BlockId.Bedrock]: {
    id: BlockId.Bedrock,
    name: 'Bedrock',
    solid: true,
    transparent: false,
    liquid: false,
    breakable: false,
    faces: allFaces(TileIndex.Bedrock),
  },
};

export const HOTBAR_BLOCKS: BlockId[] = [
  BlockId.Grass,
  BlockId.Dirt,
  BlockId.Stone,
  BlockId.Cobblestone,
  BlockId.OakPlanks,
  BlockId.OakLog,
  BlockId.OakLeaves,
  BlockId.Sand,
  BlockId.Glass,
];

export function isBlockSolid(id: BlockId): boolean {
  return BLOCKS[id]?.solid ?? false;
}

export function isBlockOpaque(id: BlockId): boolean {
  const def = BLOCKS[id];
  return def ? def.solid && !def.transparent : false;
}
