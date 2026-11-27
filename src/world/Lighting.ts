import { BlockId } from '../content/BlockId';
import { BLOCKS } from '../content/BlockRegistry';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk } from './Chunk';

const DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

// Flat LUTs avoid repeated object-property lookups inside tight voxel lighting loops.
const BLOCK_OPACITY = new Uint8Array(256);
const BLOCK_EMISSION = new Uint8Array(256);
for (const [key, def] of Object.entries(BLOCKS)) {
  const id = Number(key);
  if (Number.isInteger(id) && id >= 0 && id < 256) {
    BLOCK_OPACITY[id] = def.lightOpacity;
    BLOCK_EMISSION[id] = def.lightEmission;
  }
}

// Reusable flat typed queue buffers to avoid GC churn during chunk lighting.
const MAX_QUEUE = 128 * 1024;
const qx = new Int32Array(MAX_QUEUE);
const qy = new Int16Array(MAX_QUEUE);
const qz = new Int32Array(MAX_QUEUE);

const LAYER_SIZE = CHUNK_SIZE * CHUNK_SIZE;

export type ChunkLookup = (cx: number, cz: number) => Chunk | undefined;

function worldToChunk(n: number): number {
  return n >> 4;
}

function worldToLocal(n: number): number {
  return n & 15;
}

/**
 * Computes initial skylight + block light for a newly generated chunk and bleeds into loaded neighbors.
 */
export function initializeChunkLighting(
  chunk: Chunk,
  getChunk: ChunkLookup,
  markMeshDirty: (cx: number, cz: number) => void
): void {
  const cx = chunk.cx;
  const cz = chunk.cz;
  const baseX = cx * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;
  const data = chunk.data;
  const light = chunk.light;

  const negX = getChunk(cx - 1, cz);
  const posX = getChunk(cx + 1, cz);
  const negZ = getChunk(cx, cz - 1);
  const posZ = getChunk(cx, cz + 1);

  // Step 1: Cast vertical sunlight columns downward and compute chunk maxNonAirY in the same pass.
  let chunkMaxY = -1;
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    const rowOff = lz * CHUNK_SIZE;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      let currentSky = 15;
      let idx = (CHUNK_HEIGHT - 1) * LAYER_SIZE + rowOff + lx;
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--, idx -= LAYER_SIZE) {
        const blockId = data[idx];
        if (blockId !== 0) {
          if (y > chunkMaxY) chunkMaxY = y;
          const opacity = BLOCK_OPACITY[blockId];
          if (opacity >= 15) {
            currentSky = 0;
          } else if (opacity > 0) {
            currentSky = currentSky > opacity ? currentSky - opacity : 0;
          }
        }
        light[idx] = currentSky << 4;
      }
    }
  }
  chunk.maxNonAirY = chunkMaxY;

  // Above the highest non-air voxel across this chunk and its 4 neighbors, every voxel is open sky (15).
  let maxRelevantY = chunkMaxY;
  if (negX && negX.maxNonAirY > maxRelevantY) maxRelevantY = negX.maxNonAirY;
  if (posX && posX.maxNonAirY > maxRelevantY) maxRelevantY = posX.maxNonAirY;
  if (negZ && negZ.maxNonAirY > maxRelevantY) maxRelevantY = negZ.maxNonAirY;
  if (posZ && posZ.maxNonAirY > maxRelevantY) maxRelevantY = posZ.maxNonAirY;
  const scanTopY = Math.min(CHUNK_HEIGHT - 1, maxRelevantY + 1);

  // Step 2: Enqueue only skylight seeds that actually border a darker transparent voxel.
  let skyTail = 0;
  for (let y = 0; y <= scanTopY; y++) {
    const yBase = y * LAYER_SIZE;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const rowBase = yBase + lz * CHUNK_SIZE;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const idx = rowBase + lx;
        const sl = light[idx] >> 4;
        if (sl <= 1) continue;
        const threshold = sl - 1;

        let needsSeed = false;

        // +X neighbor
        if (lx < 15) {
          if (BLOCK_OPACITY[data[idx + 1]] < 15 && (light[idx + 1] >> 4) < threshold) needsSeed = true;
        } else if (posX) {
          const nIdx = rowBase;
          if (BLOCK_OPACITY[posX.data[nIdx]] < 15 && (posX.light[nIdx] >> 4) < threshold) needsSeed = true;
        }

        // -X neighbor
        if (!needsSeed) {
          if (lx > 0) {
            if (BLOCK_OPACITY[data[idx - 1]] < 15 && (light[idx - 1] >> 4) < threshold) needsSeed = true;
          } else if (negX) {
            const nIdx = rowBase + 15;
            if (BLOCK_OPACITY[negX.data[nIdx]] < 15 && (negX.light[nIdx] >> 4) < threshold) needsSeed = true;
          }
        }

        // +Z neighbor
        if (!needsSeed) {
          if (lz < 15) {
            if (BLOCK_OPACITY[data[idx + 16]] < 15 && (light[idx + 16] >> 4) < threshold) needsSeed = true;
          } else if (posZ) {
            const nIdx = yBase + lx;
            if (BLOCK_OPACITY[posZ.data[nIdx]] < 15 && (posZ.light[nIdx] >> 4) < threshold) needsSeed = true;
          }
        }

        // -Z neighbor
        if (!needsSeed) {
          if (lz > 0) {
            if (BLOCK_OPACITY[data[idx - 16]] < 15 && (light[idx - 16] >> 4) < threshold) needsSeed = true;
          } else if (negZ) {
            const nIdx = yBase + 15 * 16 + lx;
            if (BLOCK_OPACITY[negZ.data[nIdx]] < 15 && (negZ.light[nIdx] >> 4) < threshold) needsSeed = true;
          }
        }

        if (needsSeed && skyTail < MAX_QUEUE) {
          qx[skyTail] = baseX + lx;
          qy[skyTail] = y;
          qz[skyTail] = baseZ + lz;
          skyTail++;
        }
      }
    }
  }

  // Pull skylight inward from loaded cardinal borders ONLY where neighbor is brighter than chunk border.
  const pullSkyBorder = (
    nChunk: Chunk | undefined,
    nBaseX: number,
    nBaseZ: number,
    nFixed: number,
    cFixed: number,
    varyZ: boolean
  ): void => {
    if (!nChunk) return;
    const nLight = nChunk.light;
    for (let y = 0; y <= scanTopY; y++) {
      const yBase = y * LAYER_SIZE;
      for (let i = 0; i < CHUNK_SIZE; i++) {
        const nlx = varyZ ? nFixed : i;
        const nlz = varyZ ? i : nFixed;
        const nSl = nLight[yBase + nlz * CHUNK_SIZE + nlx] >> 4;
        if (nSl <= 1) continue;
        const clx = varyZ ? cFixed : i;
        const clz = varyZ ? i : cFixed;
        const cIdx = yBase + clz * CHUNK_SIZE + clx;
        if (BLOCK_OPACITY[data[cIdx]] < 15 && (light[cIdx] >> 4) < nSl - 1 && skyTail < MAX_QUEUE) {
          qx[skyTail] = nBaseX + nlx;
          qy[skyTail] = y;
          qz[skyTail] = nBaseZ + nlz;
          skyTail++;
        }
      }
    }
  };

  pullSkyBorder(negX, (cx - 1) * CHUNK_SIZE, baseZ, 15, 0, true);
  pullSkyBorder(posX, (cx + 1) * CHUNK_SIZE, baseZ, 0, 15, true);
  pullSkyBorder(negZ, baseX, (cz - 1) * CHUNK_SIZE, 15, 0, false);
  pullSkyBorder(posZ, baseX, (cz + 1) * CHUNK_SIZE, 0, 15, false);

  if (skyTail > 0) {
    propagateSkyQueue(0, skyTail, getChunk, markMeshDirty);
  }

  // Step 3: Seed emissive blocks inside this chunk (only up to chunkMaxY) + neighbor borders.
  let blkTail = 0;
  for (let y = 0; y <= chunkMaxY; y++) {
    const yBase = y * LAYER_SIZE;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const rowBase = yBase + lz * CHUNK_SIZE;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const idx = rowBase + lx;
        const emission = BLOCK_EMISSION[data[idx]];
        if (emission > 0) {
          light[idx] = (light[idx] & 0xf0) | emission;
          if (blkTail < MAX_QUEUE) {
            qx[blkTail] = baseX + lx;
            qy[blkTail] = y;
            qz[blkTail] = baseZ + lz;
            blkTail++;
          }
        }
      }
    }
  }

  const pullBlockBorder = (
    nChunk: Chunk | undefined,
    nBaseX: number,
    nBaseZ: number,
    nFixed: number,
    cFixed: number,
    varyZ: boolean
  ): void => {
    if (!nChunk) return;
    const nLight = nChunk.light;
    for (let y = 0; y <= scanTopY; y++) {
      const yBase = y * LAYER_SIZE;
      for (let i = 0; i < CHUNK_SIZE; i++) {
        const nlx = varyZ ? nFixed : i;
        const nlz = varyZ ? i : nFixed;
        const nBlk = nLight[yBase + nlz * CHUNK_SIZE + nlx] & 0xf;
        if (nBlk <= 1) continue;
        const clx = varyZ ? cFixed : i;
        const clz = varyZ ? i : cFixed;
        const cIdx = yBase + clz * CHUNK_SIZE + clx;
        if (BLOCK_OPACITY[data[cIdx]] < 15 && (light[cIdx] & 0xf) < nBlk - 1 && blkTail < MAX_QUEUE) {
          qx[blkTail] = nBaseX + nlx;
          qy[blkTail] = y;
          qz[blkTail] = nBaseZ + nlz;
          blkTail++;
        }
      }
    }
  };

  pullBlockBorder(negX, (cx - 1) * CHUNK_SIZE, baseZ, 15, 0, true);
  pullBlockBorder(posX, (cx + 1) * CHUNK_SIZE, baseZ, 0, 15, true);
  pullBlockBorder(negZ, baseX, (cz - 1) * CHUNK_SIZE, 15, 0, false);
  pullBlockBorder(posZ, baseX, (cz + 1) * CHUNK_SIZE, 0, 15, false);

  if (blkTail > 0) {
    propagateBlockQueue(0, blkTail, getChunk, markMeshDirty);
  }
  chunk.lightDirty = false;
}

/** Fast incremental path for edits that can only add light transmission/emission. */
function addLightingAtEdit(
  wx: number,
  wy: number,
  wz: number,
  nextBlock: BlockId,
  getChunk: ChunkLookup
): Set<string> {
  const dirtyChunks = new Set<string>();
  const markDirty = (cx: number, cz: number) => dirtyChunks.add(Chunk.key(cx, cz));
  const editCx = worldToChunk(wx);
  const editCz = worldToChunk(wz);
  const chunk = getChunk(editCx, editCz);
  if (!chunk) return dirtyChunks;
  const editLx = worldToLocal(wx);
  const editLz = worldToLocal(wz);
  markDirty(editCx, editCz);

  let skyTail = 0;
  let directSky = 15;
  for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
    const opacity = BLOCK_OPACITY[chunk.data[(y * CHUNK_SIZE + editLz) * CHUNK_SIZE + editLx]];
    if (opacity >= 15) directSky = 0;
    else if (opacity > 0) directSky = Math.max(0, directSky - opacity);
    if (directSky <= chunk.getSkyLight(editLx, y, editLz)) continue;
    chunk.setSkyLight(editLx, y, editLz, directSky);
    if (directSky > 1 && skyTail < MAX_QUEUE) {
      qx[skyTail] = wx;
      qy[skyTail] = y;
      qz[skyTail] = wz;
      skyTail++;
    }
  }

  for (const [dx, dy, dz] of DIRS) {
    const x = wx + dx;
    const y = wy + dy;
    const z = wz + dz;
    if (y < 0 || y >= CHUNK_HEIGHT || skyTail >= MAX_QUEUE) continue;
    const neighbor = getChunk(worldToChunk(x), worldToChunk(z));
    if (!neighbor) continue;
    if (neighbor.getSkyLight(worldToLocal(x), y, worldToLocal(z)) <= 1) continue;
    qx[skyTail] = x;
    qy[skyTail] = y;
    qz[skyTail] = z;
    skyTail++;
  }
  propagateSkyQueue(0, skyTail, getChunk, markDirty);

  let blockTail = 0;
  const emission = BLOCK_EMISSION[nextBlock];
  if (emission > chunk.getBlockLight(editLx, wy, editLz)) {
    chunk.setBlockLight(editLx, wy, editLz, emission);
    qx[blockTail] = wx;
    qy[blockTail] = wy;
    qz[blockTail] = wz;
    blockTail++;
  }
  for (const [dx, dy, dz] of DIRS) {
    const x = wx + dx;
    const y = wy + dy;
    const z = wz + dz;
    if (y < 0 || y >= CHUNK_HEIGHT || blockTail >= MAX_QUEUE) continue;
    const neighbor = getChunk(worldToChunk(x), worldToChunk(z));
    if (!neighbor) continue;
    if (neighbor.getBlockLight(worldToLocal(x), y, worldToLocal(z)) <= 1) continue;
    qx[blockTail] = x;
    qy[blockTail] = y;
    qz[blockTail] = z;
    blockTail++;
  }
  propagateBlockQueue(0, blockTail, getChunk, markDirty);

  if (editLx === 0) dirtyChunks.add(Chunk.key(editCx - 1, editCz));
  if (editLx === CHUNK_SIZE - 1) dirtyChunks.add(Chunk.key(editCx + 1, editCz));
  if (editLz === 0) dirtyChunks.add(Chunk.key(editCx, editCz - 1));
  if (editLz === CHUNK_SIZE - 1) dirtyChunks.add(Chunk.key(editCx, editCz + 1));
  return dirtyChunks;
}

/**
 * Updates skylight and block light around a modified voxel. Light-increasing edits use
 * the incremental path above; light-removing/occluding edits use a bounded radius-15
 * rebuild so stale illumination cannot survive.
 */
export function updateLightingAtEdit(
  wx: number,
  wy: number,
  wz: number,
  previousBlock: BlockId,
  nextBlock: BlockId,
  getChunk: ChunkLookup
): Set<string> {
  if (
    BLOCK_OPACITY[nextBlock] <= BLOCK_OPACITY[previousBlock]
    && BLOCK_EMISSION[nextBlock] >= BLOCK_EMISSION[previousBlock]
  ) {
    return addLightingAtEdit(wx, wy, wz, nextBlock, getChunk);
  }

  const dirtyChunks = new Set<string>();
  const R = 15;

  const minX = wx - R;
  const maxX = wx + R;
  const minZ = wz - R;
  const maxZ = wz + R;
  const minY = Math.max(0, wy - R);
  const maxY = Math.min(CHUNK_HEIGHT - 1, wy + R);

  const markDirty = (cx: number, cz: number) => {
    dirtyChunks.add(Chunk.key(cx, cz));
  };

  let skyTail = 0;
  for (let z = minZ; z <= maxZ; z++) {
    const cz = worldToChunk(z);
    const lz = worldToLocal(z);
    for (let x = minX; x <= maxX; x++) {
      const cx = worldToChunk(x);
      const c = getChunk(cx, cz);
      if (!c) continue;
      const lx = worldToLocal(x);
      let currentSky = 15;
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        const opacity = BLOCK_OPACITY[c.data[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx]];
        if (opacity >= 15) currentSky = 0;
        else if (opacity > 0) currentSky = Math.max(0, currentSky - opacity);
        if (y < minY || y > maxY) continue;

        if (c.getSkyLight(lx, y, lz) !== currentSky) {
          c.setSkyLight(lx, y, lz, currentSky);
          markDirty(cx, cz);
        }
        if (c.getBlockLight(lx, y, lz) !== 0) {
          c.setBlockLight(lx, y, lz, 0);
          markDirty(cx, cz);
        }
      }
    }
  }

  for (let z = minZ; z <= maxZ; z++) {
    for (let x = minX; x <= maxX; x++) {
      const cx = worldToChunk(x);
      const cz = worldToChunk(z);
      const c = getChunk(cx, cz);
      if (!c) continue;
      const lx = worldToLocal(x);
      const lz = worldToLocal(z);
      for (let y = minY; y <= maxY; y++) {
        const level = c.getSkyLight(lx, y, lz);
        if (level <= 1) continue;
        let bordersDarkness = false;
        for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const nx = x + dx;
          const nz = z + dz;
          const neighbor = getChunk(worldToChunk(nx), worldToChunk(nz));
          if (!neighbor) continue;
          const nlx = worldToLocal(nx);
          const nlz = worldToLocal(nz);
          if (BLOCK_OPACITY[neighbor.data[(y * CHUNK_SIZE + nlz) * CHUNK_SIZE + nlx]] >= 15) continue;
          if (neighbor.getSkyLight(nlx, y, nlz) < level - 1) {
            bordersDarkness = true;
            break;
          }
        }
        if (!bordersDarkness || skyTail >= MAX_QUEUE) continue;
        qx[skyTail] = x;
        qy[skyTail] = y;
        qz[skyTail] = z;
        skyTail++;
      }
    }
  }

  for (let z = minZ - 1; z <= maxZ + 1; z++) {
    const cz = worldToChunk(z);
    const lz = worldToLocal(z);
    for (let x = minX - 1; x <= maxX + 1; x++) {
      const cx = worldToChunk(x);
      const c = getChunk(cx, cz);
      if (!c) continue;
      const lx = worldToLocal(x);
      const onXZShell = x === minX - 1 || x === maxX + 1
        || z === minZ - 1 || z === maxZ + 1;
      const yStart = Math.max(0, minY - 1);
      const yEnd = Math.min(CHUNK_HEIGHT - 1, maxY + 1);
      for (let y = yStart; y <= yEnd; y++) {
        const onShell = onXZShell || y === minY - 1 || y === maxY + 1;
        if (!onShell || c.getSkyLight(lx, y, lz) <= 1 || skyTail >= MAX_QUEUE) continue;
        qx[skyTail] = x;
        qy[skyTail] = y;
        qz[skyTail] = z;
        skyTail++;
      }
    }
  }
  propagateSkyQueue(0, skyTail, getChunk, markDirty);

  let blkTail = 0;
  for (let z = minZ - 1; z <= maxZ + 1; z++) {
    const cz = worldToChunk(z);
    const lz = worldToLocal(z);
    for (let x = minX - 1; x <= maxX + 1; x++) {
      const cx = worldToChunk(x);
      const c = getChunk(cx, cz);
      if (!c) continue;
      const lx = worldToLocal(x);

      const onXZShell = x === minX - 1 || x === maxX + 1 || z === minZ - 1 || z === maxZ + 1;
      const yStart = Math.max(0, minY - 1);
      const yEnd = Math.min(CHUNK_HEIGHT - 1, maxY + 1);

      for (let y = yStart; y <= yEnd; y++) {
        const onShell = onXZShell || y === minY - 1 || y === maxY + 1;
        if (onShell) {
          if (c.getBlockLight(lx, y, lz) > 1 && blkTail < MAX_QUEUE) {
            qx[blkTail] = x;
            qy[blkTail] = y;
            qz[blkTail] = z;
            blkTail++;
          }
        } else {
          const em = BLOCK_EMISSION[c.data[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx]];
          if (em > 0) {
            c.setBlockLight(lx, y, lz, em);
            if (blkTail < MAX_QUEUE) {
              qx[blkTail] = x;
              qy[blkTail] = y;
              qz[blkTail] = z;
              blkTail++;
            }
          }
        }
      }
    }
  }
  propagateBlockQueue(0, blkTail, getChunk, markDirty);

  const editCx = worldToChunk(wx);
  const editCz = worldToChunk(wz);
  const editLx = worldToLocal(wx);
  const editLz = worldToLocal(wz);
  if (editLx === 0) dirtyChunks.add(Chunk.key(editCx - 1, editCz));
  if (editLx === CHUNK_SIZE - 1) dirtyChunks.add(Chunk.key(editCx + 1, editCz));
  if (editLz === 0) dirtyChunks.add(Chunk.key(editCx, editCz - 1));
  if (editLz === CHUNK_SIZE - 1) dirtyChunks.add(Chunk.key(editCx, editCz + 1));

  return dirtyChunks;
}

function propagateSkyQueue(
  head: number,
  tail: number,
  getChunk: ChunkLookup,
  markDirty: (cx: number, cz: number) => void
): void {
  let cachedCx = 0x7fffffff;
  let cachedCz = 0x7fffffff;
  let cachedChunk: Chunk | undefined;

  while (head < tail) {
    const x = qx[head];
    const y = qy[head];
    const z = qz[head];
    head++;

    const cx = x >> 4;
    const cz = z >> 4;
    let chunk: Chunk | undefined;
    if (cx === cachedCx && cz === cachedCz) {
      chunk = cachedChunk;
    } else {
      chunk = getChunk(cx, cz);
      cachedCx = cx;
      cachedCz = cz;
      cachedChunk = chunk;
    }
    if (!chunk) continue;

    const lx = x & 15;
    const lz = z & 15;
    const cur = chunk.light[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] >> 4;
    if (cur <= 1) continue;

    for (let d = 0; d < 6; d++) {
      const dir = DIRS[d];
      const nx = x + dir[0];
      const ny = y + dir[1];
      const nz = z + dir[2];
      if (ny < 0 || ny >= CHUNK_HEIGHT) continue;

      const ncx = nx >> 4;
      const ncz = nz >> 4;
      const nChunk = ncx === cx && ncz === cz ? chunk : getChunk(ncx, ncz);
      if (!nChunk) continue;

      const nlx = nx & 15;
      const nlz = nz & 15;
      const nIdx = (ny * CHUNK_SIZE + nlz) * CHUNK_SIZE + nlx;
      const opacity = BLOCK_OPACITY[nChunk.data[nIdx]];
      if (opacity >= 15) continue;

      const nextLevel = cur - (opacity > 1 ? opacity : 1);
      const curPacked = nChunk.light[nIdx];
      if (nextLevel > (curPacked >> 4)) {
        nChunk.light[nIdx] = ((nextLevel & 0xf) << 4) | (curPacked & 0xf);
        markDirty(ncx, ncz);
        if (tail < MAX_QUEUE) {
          qx[tail] = nx;
          qy[tail] = ny;
          qz[tail] = nz;
          tail++;
        }
      }
    }
  }
}

function propagateBlockQueue(
  head: number,
  tail: number,
  getChunk: ChunkLookup,
  markDirty: (cx: number, cz: number) => void
): void {
  let cachedCx = 0x7fffffff;
  let cachedCz = 0x7fffffff;
  let cachedChunk: Chunk | undefined;

  while (head < tail) {
    const x = qx[head];
    const y = qy[head];
    const z = qz[head];
    head++;

    const cx = x >> 4;
    const cz = z >> 4;
    let chunk: Chunk | undefined;
    if (cx === cachedCx && cz === cachedCz) {
      chunk = cachedChunk;
    } else {
      chunk = getChunk(cx, cz);
      cachedCx = cx;
      cachedCz = cz;
      cachedChunk = chunk;
    }
    if (!chunk) continue;

    const lx = x & 15;
    const lz = z & 15;
    const cur = chunk.light[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] & 0xf;
    if (cur <= 1) continue;

    for (let d = 0; d < 6; d++) {
      const dir = DIRS[d];
      const nx = x + dir[0];
      const ny = y + dir[1];
      const nz = z + dir[2];
      if (ny < 0 || ny >= CHUNK_HEIGHT) continue;

      const ncx = nx >> 4;
      const ncz = nz >> 4;
      const nChunk = ncx === cx && ncz === cz ? chunk : getChunk(ncx, ncz);
      if (!nChunk) continue;

      const nlx = nx & 15;
      const nlz = nz & 15;
      const nIdx = (ny * CHUNK_SIZE + nlz) * CHUNK_SIZE + nlx;
      const opacity = BLOCK_OPACITY[nChunk.data[nIdx]];
      if (opacity >= 15) continue;

      const nextLevel = cur - (opacity > 1 ? opacity : 1);
      const curPacked = nChunk.light[nIdx];
      if (nextLevel > (curPacked & 0xf)) {
        nChunk.light[nIdx] = (curPacked & 0xf0) | (nextLevel & 0xf);
        markDirty(ncx, ncz);
        if (tail < MAX_QUEUE) {
          qx[tail] = nx;
          qy[tail] = ny;
          qz[tail] = nz;
          tail++;
        }
      }
    }
  }
}
