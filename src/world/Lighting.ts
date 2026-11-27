import { BlockId } from '../content/BlockId';
import { BLOCKS } from '../content/BlockRegistry';
import { CHUNK_HEIGHT, CHUNK_SIZE, Chunk } from './Chunk';

const DIRS: ReadonlyArray<[number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

// Reusable flat typed ring/queue buffers to avoid GC churn during chunk lighting
const MAX_QUEUE = 128 * 1024;
const qx = new Int32Array(MAX_QUEUE);
const qy = new Int16Array(MAX_QUEUE);
const qz = new Int32Array(MAX_QUEUE);

export type ChunkLookup = (cx: number, cz: number) => Chunk | undefined;

function worldToChunk(n: number): number {
  return Math.floor(n / CHUNK_SIZE);
}

function worldToLocal(n: number): number {
  return ((n % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
}

/**
 * Computes initial skylight + block light for a newly generated chunk and bleeds into loaded neighbors.
 */
export function initializeChunkLighting(
  chunk: Chunk,
  getChunk: ChunkLookup,
  markMeshDirty: (cx: number, cz: number) => void
): void {
  const baseX = chunk.cx * CHUNK_SIZE;
  const baseZ = chunk.cz * CHUNK_SIZE;

  let skyHead = 0;
  let skyTail = 0;

  // Step 1: Cast vertical sunlight columns from top of chunk downward
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      let currentSky = 15;
      for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
        const blockId = chunk.get(lx, y, lz);
        const opacity = BLOCKS[blockId].lightOpacity;

        if (opacity >= 15) {
          currentSky = 0;
        } else if (opacity > 0) {
          currentSky = Math.max(0, currentSky - opacity);
        }

        chunk.setSkyLight(lx, y, lz, currentSky);
      }
    }
  }

  // Enqueue skylight seeds inside this chunk + immediate border columns of loaded neighbors
  const enqueueSky = (wx: number, wy: number, wz: number) => {
    if (skyTail < MAX_QUEUE) {
      qx[skyTail] = wx;
      qy[skyTail] = wy;
      qz[skyTail] = wz;
      skyTail++;
    }
  };

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const sl = chunk.getSkyLight(lx, y, lz);
        if (sl > 1) {
          // Only enqueue if adjacent to a darker transparent voxel to keep queue compact
          if (
            chunk.getSkyLight(lx + 1, y, lz) < sl - 1 ||
            chunk.getSkyLight(lx - 1, y, lz) < sl - 1 ||
            chunk.getSkyLight(lx, y, lz + 1) < sl - 1 ||
            chunk.getSkyLight(lx, y, lz - 1) < sl - 1 ||
            lx === 0 ||
            lx === CHUNK_SIZE - 1 ||
            lz === 0 ||
            lz === CHUNK_SIZE - 1
          ) {
            enqueueSky(baseX + lx, y, baseZ + lz);
          }
        }
      }
    }
  }

  // Also pull light inward from the 4 adjacent chunk borders if already loaded
  const pullBorder = (ncx: number, ncz: number, lxFixed: number, lzFixed: number, varyZ: boolean) => {
    const nChunk = getChunk(ncx, ncz);
    if (!nChunk) return;
    const nBaseX = ncx * CHUNK_SIZE;
    const nBaseZ = ncz * CHUNK_SIZE;
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let i = 0; i < CHUNK_SIZE; i++) {
        const lx = varyZ ? lxFixed : i;
        const lz = varyZ ? i : lzFixed;
        if (nChunk.getSkyLight(lx, y, lz) > 1) {
          enqueueSky(nBaseX + lx, y, nBaseZ + lz);
        }
      }
    }
  };

  pullBorder(chunk.cx - 1, chunk.cz, CHUNK_SIZE - 1, 0, true);
  pullBorder(chunk.cx + 1, chunk.cz, 0, 0, true);
  pullBorder(chunk.cx, chunk.cz - 1, 0, CHUNK_SIZE - 1, false);
  pullBorder(chunk.cx, chunk.cz + 1, 0, 0, false);

  propagateSkyQueue(skyHead, skyTail, getChunk, markMeshDirty);

  // Step 2: Seed emissive blocks (crystals/torches) in this chunk + neighbor borders
  let blkHead = 0;
  let blkTail = 0;
  const enqueueBlk = (wx: number, wy: number, wz: number) => {
    if (blkTail < MAX_QUEUE) {
      qx[blkTail] = wx;
      qy[blkTail] = wy;
      qz[blkTail] = wz;
      blkTail++;
    }
  };

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const emission = BLOCKS[chunk.get(lx, y, lz)].lightEmission;
        if (emission > 0) {
          chunk.setBlockLight(lx, y, lz, emission);
          enqueueBlk(baseX + lx, y, baseZ + lz);
        }
      }
    }
  }

  // Pull existing block light across loaded chunk borders
  const pullBlockBorder = (ncx: number, ncz: number, lxFixed: number, lzFixed: number, varyZ: boolean) => {
    const nChunk = getChunk(ncx, ncz);
    if (!nChunk) return;
    const nBaseX = ncx * CHUNK_SIZE;
    const nBaseZ = ncz * CHUNK_SIZE;
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let i = 0; i < CHUNK_SIZE; i++) {
        const lx = varyZ ? lxFixed : i;
        const lz = varyZ ? i : lzFixed;
        if (nChunk.getBlockLight(lx, y, lz) > 1) {
          enqueueBlk(nBaseX + lx, y, nBaseZ + lz);
        }
      }
    }
  };

  pullBlockBorder(chunk.cx - 1, chunk.cz, CHUNK_SIZE - 1, 0, true);
  pullBlockBorder(chunk.cx + 1, chunk.cz, 0, 0, true);
  pullBlockBorder(chunk.cx, chunk.cz - 1, 0, CHUNK_SIZE - 1, false);
  pullBlockBorder(chunk.cx, chunk.cz + 1, 0, 0, false);

  propagateBlockQueue(blkHead, blkTail, getChunk, markMeshDirty);
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
    const opacity = BLOCKS[chunk.get(editLx, y, editLz)].lightOpacity;
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
  const emission = BLOCKS[nextBlock].lightEmission;
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
  const previous = BLOCKS[previousBlock];
  const next = BLOCKS[nextBlock];
  if (
    next.lightOpacity <= previous.lightOpacity
    && next.lightEmission >= previous.lightEmission
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

  // 1. Reset only the bounded 3D region that a level-15 light change can reach.
  // Scan full columns to derive direct skylight, but avoid queueing every lit voxel in
  // the world's full height (the old path queued ~140k entries for each block edit).
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
        const opacity = BLOCKS[c.get(lx, y, lz)].lightOpacity;
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

  // Queue only direct-sky cells bordering a darker horizontal neighbor. Fully open
  // sky columns already contain their final value and do not need flood-fill work.
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
          if (BLOCKS[neighbor.get(nlx, y, nlz)].lightOpacity >= 15) continue;
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

  // 2. Re-seed lateral skylight from the unchanged one-voxel shell around the box.
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

  // 3. Re-seed block light from emitters inside box + existing light on the 1-voxel shell outside box
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
          const em = BLOCKS[c.get(lx, y, lz)].lightEmission;
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

  // Face visibility crosses a chunk boundary only when the edited voxel itself lies on it.
  // Light propagation already marks every chunk whose light bytes actually changed.
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
  while (head < tail) {
    const x = qx[head];
    const y = qy[head];
    const z = qz[head];
    head++;

    const cx = worldToChunk(x);
    const cz = worldToChunk(z);
    const chunk = getChunk(cx, cz);
    if (!chunk) continue;

    const lx = worldToLocal(x);
    const lz = worldToLocal(z);
    const cur = chunk.getSkyLight(lx, y, lz);
    if (cur <= 1) continue;

    for (let d = 0; d < 6; d++) {
      const nx = x + DIRS[d][0];
      const ny = y + DIRS[d][1];
      const nz = z + DIRS[d][2];
      if (ny < 0 || ny >= CHUNK_HEIGHT) continue;

      const ncx = worldToChunk(nx);
      const ncz = worldToChunk(nz);
      const nChunk = ncx === cx && ncz === cz ? chunk : getChunk(ncx, ncz);
      if (!nChunk) continue;

      const nlx = worldToLocal(nx);
      const nlz = worldToLocal(nz);
      const nBlock = nChunk.get(nlx, ny, nlz);
      const opacity = BLOCKS[nBlock].lightOpacity;
      if (opacity >= 15) continue;

      const stepCost = Math.max(1, opacity);
      const nextLevel = cur - stepCost;
      if (nextLevel > nChunk.getSkyLight(nlx, ny, nlz)) {
        nChunk.setSkyLight(nlx, ny, nlz, nextLevel);
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
  while (head < tail) {
    const x = qx[head];
    const y = qy[head];
    const z = qz[head];
    head++;

    const cx = worldToChunk(x);
    const cz = worldToChunk(z);
    const chunk = getChunk(cx, cz);
    if (!chunk) continue;

    const lx = worldToLocal(x);
    const lz = worldToLocal(z);
    const cur = chunk.getBlockLight(lx, y, lz);
    if (cur <= 1) continue;

    for (let d = 0; d < 6; d++) {
      const nx = x + DIRS[d][0];
      const ny = y + DIRS[d][1];
      const nz = z + DIRS[d][2];
      if (ny < 0 || ny >= CHUNK_HEIGHT) continue;

      const ncx = worldToChunk(nx);
      const ncz = worldToChunk(nz);
      const nChunk = ncx === cx && ncz === cz ? chunk : getChunk(ncx, ncz);
      if (!nChunk) continue;

      const nlx = worldToLocal(nx);
      const nlz = worldToLocal(nz);
      const nBlock = nChunk.get(nlx, ny, nlz);
      const opacity = BLOCKS[nBlock].lightOpacity;
      if (opacity >= 15) continue;

      const stepCost = Math.max(1, opacity);
      const nextLevel = cur - stepCost;
      if (nextLevel > nChunk.getBlockLight(nlx, ny, nlz)) {
        nChunk.setBlockLight(nlx, ny, nlz, nextLevel);
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
