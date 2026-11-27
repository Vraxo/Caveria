import type { BiomeSize } from '../Biomes/BiomeSize';

export interface GeneratedChunkData {
  cx: number;
  cz: number;
  data: Uint8Array;
}

interface WorkerResponse {
  type: 'generated';
  requestId: number;
  cx: number;
  cz: number;
  data: ArrayBuffer;
}

interface PendingRequest {
  cx: number;
  cz: number;
  resolve: (result: GeneratedChunkData) => void;
  reject: (reason: unknown) => void;
}

/**
 * Queues deterministic terrain generation on a dedicated module worker.
 * ArrayBuffers are transferred rather than copied back to the main thread.
 */
export class ChunkPipeline {
  public readonly supported: boolean;
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();

  constructor(
    private readonly seed: number,
    private readonly biomeSize: BiomeSize
  ) {
    this.supported = typeof Worker !== 'undefined';
    if (!this.supported) return;

    try {
      this.worker = new Worker(new URL('./ChunkWorker.ts', import.meta.url), { type: 'module' });
      this.worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;
        if (response.type !== 'generated') return;
        const pending = this.pending.get(response.requestId);
        if (!pending) return;
        this.pending.delete(response.requestId);
        pending.resolve({
          cx: response.cx,
          cz: response.cz,
          data: new Uint8Array(response.data),
        });
      });
      this.worker.addEventListener('error', (event) => {
        console.warn('[Caveria] Chunk worker failed; pending chunks will retry synchronously.', event.message);
        for (const request of this.pending.values()) request.reject(new Error(event.message));
        this.pending.clear();
        this.worker?.terminate();
        this.worker = null;
      });
    } catch (error) {
      console.warn('[Caveria] Web Worker unavailable; using synchronous chunk generation.', error);
      this.worker = null;
    }
  }

  public get active(): boolean {
    return this.worker !== null;
  }

  public generate(cx: number, cz: number): Promise<GeneratedChunkData> {
    if (!this.worker) return Promise.reject(new Error('Chunk worker is unavailable'));
    const requestId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { cx, cz, resolve, reject });
      this.worker!.postMessage({
        type: 'generate',
        requestId,
        seed: this.seed,
        biomeSize: this.biomeSize,
        cx,
        cz,
      });
    });
  }
}
