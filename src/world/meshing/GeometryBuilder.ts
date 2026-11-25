export type Vec3 = [number, number, number];

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  colors: Float32Array;
  indices: Uint16Array | Uint32Array;
}

/** Accumulates mesh attributes without depending on Three.js. */
export class GeometryBuilder {
  public readonly positions: number[] = [];
  public readonly normals: number[] = [];
  public readonly uvs: number[] = [];
  public readonly colors: number[] = [];
  public readonly indices: number[] = [];
  public vertexCount = 0;

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
    const base = this.vertexCount;
    this.positions.push(...v0, ...v1, ...v2, ...v3);
    for (let i = 0; i < 4; i++) {
      this.normals.push(...normal);
      this.colors.push(shade, sky, block);
    }
    this.uvs.push(u0, v0uv, u1, v0uv, u1, v1uv, u0, v1uv);
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.vertexCount += 4;
  }

  public toMeshData(): MeshData | null {
    if (this.vertexCount === 0) return null;
    const IndexArray = this.vertexCount <= 65_535 ? Uint16Array : Uint32Array;
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      colors: new Float32Array(this.colors),
      indices: new IndexArray(this.indices),
    };
  }
}
