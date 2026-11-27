export type Vec3 = [number, number, number];

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  indices: Uint16Array | Uint32Array;
}

const INITIAL_VERTEX_CAPACITY = 8192;

/**
 * Reusable typed-array geometry accumulator that avoids JS number[] growth and GC churn
 * during chunk meshing while remaining Three.js-independent.
 */
export class GeometryBuilder {
  private vertexCap = INITIAL_VERTEX_CAPACITY;
  private indexCap = INITIAL_VERTEX_CAPACITY * 2;

  private posBuf = new Float32Array(this.vertexCap * 3);
  private normBuf = new Float32Array(this.vertexCap * 3);
  private uvBuf = new Float32Array(this.vertexCap * 2);
  private colBuf = new Float32Array(this.vertexCap * 3);
  private idxBuf = new Uint32Array(this.indexCap);

  public vertexCount = 0;
  private indexCount = 0;

  public reset(): void {
    this.vertexCount = 0;
    this.indexCount = 0;
  }

  public ensureVertexCapacity(extraVertices: number): void {
    const needed = this.vertexCount + extraVertices;
    if (needed <= this.vertexCap) return;
    let nextCap = this.vertexCap * 2;
    while (nextCap < needed) nextCap *= 2;
    this.vertexCap = nextCap;

    const nextPos = new Float32Array(nextCap * 3);
    nextPos.set(this.posBuf.subarray(0, this.vertexCount * 3));
    this.posBuf = nextPos;

    const nextNorm = new Float32Array(nextCap * 3);
    nextNorm.set(this.normBuf.subarray(0, this.vertexCount * 3));
    this.normBuf = nextNorm;

    const nextUv = new Float32Array(nextCap * 2);
    nextUv.set(this.uvBuf.subarray(0, this.vertexCount * 2));
    this.uvBuf = nextUv;

    const nextCol = new Float32Array(nextCap * 3);
    nextCol.set(this.colBuf.subarray(0, this.vertexCount * 3));
    this.colBuf = nextCol;
  }

  public ensureIndexCapacity(extraIndices: number): void {
    const needed = this.indexCount + extraIndices;
    if (needed <= this.indexCap) return;
    let nextCap = this.indexCap * 2;
    while (nextCap < needed) nextCap *= 2;
    this.indexCap = nextCap;

    const nextIdx = new Uint32Array(nextCap);
    nextIdx.set(this.idxBuf.subarray(0, this.indexCount));
    this.idxBuf = nextIdx;
  }

  /** Appends one vertex directly into the typed scratch buffers (caller ensures capacity). */
  public pushVertexFast(
    px: number,
    py: number,
    pz: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
    r: number,
    g: number,
    b: number
  ): void {
    const vc = this.vertexCount;
    const v3 = vc * 3;
    const v2 = vc * 2;
    this.posBuf[v3] = px;
    this.posBuf[v3 + 1] = py;
    this.posBuf[v3 + 2] = pz;
    this.normBuf[v3] = nx;
    this.normBuf[v3 + 1] = ny;
    this.normBuf[v3 + 2] = nz;
    this.uvBuf[v2] = u;
    this.uvBuf[v2 + 1] = v;
    this.colBuf[v3] = r;
    this.colBuf[v3 + 1] = g;
    this.colBuf[v3 + 2] = b;
    this.vertexCount = vc + 1;
  }

  /** Appends 6 triangle indices for a quad directly (caller ensures capacity). */
  public pushQuadIndicesFast(
    i0: number,
    i1: number,
    i2: number,
    i3: number,
    i4: number,
    i5: number
  ): void {
    const ic = this.indexCount;
    const buf = this.idxBuf;
    buf[ic] = i0;
    buf[ic + 1] = i1;
    buf[ic + 2] = i2;
    buf[ic + 3] = i3;
    buf[ic + 4] = i4;
    buf[ic + 5] = i5;
    this.indexCount = ic + 6;
  }

  public pushQuad(
    v0: Vec3,
    v1: Vec3,
    v2: Vec3,
    v3: Vec3,
    normal: Vec3,
    u0: number,
    v0uv: number,
    u1: number,
    v1uv: number,
    shade: number,
    sky: number,
    block: number
  ): void {
    this.ensureVertexCapacity(4);
    this.ensureIndexCapacity(6);
    const base = this.vertexCount;
    const nx = normal[0];
    const ny = normal[1];
    const nz = normal[2];
    this.pushVertexFast(v0[0], v0[1], v0[2], nx, ny, nz, u0, v0uv, shade, sky, block);
    this.pushVertexFast(v1[0], v1[1], v1[2], nx, ny, nz, u1, v0uv, shade, sky, block);
    this.pushVertexFast(v2[0], v2[1], v2[2], nx, ny, nz, u1, v1uv, shade, sky, block);
    this.pushVertexFast(v3[0], v3[1], v3[2], nx, ny, nz, u0, v1uv, shade, sky, block);
    this.pushQuadIndicesFast(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  public toMeshData(): MeshData | null {
    const vc = this.vertexCount;
    if (vc === 0) return null;
    const ic = this.indexCount;
    const positions = this.posBuf.slice(0, vc * 3);
    const normals = this.normBuf.slice(0, vc * 3);
    const uvs = this.uvBuf.slice(0, vc * 2);
    const colors = this.colBuf.slice(0, vc * 3);
    const indices =
      vc <= 65_535
        ? Uint16Array.from(this.idxBuf.subarray(0, ic))
        : this.idxBuf.slice(0, ic);
    return { positions, normals, uvs, colors, indices };
  }
}
