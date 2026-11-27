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
  workerIndex: number;
  cx: number;
  cz: number;
  resolve: (result: GeneratedChunkData) => void;
  reject: (reason: unknown) => void;
}

interface WorkerSlot {
  worker: Worker;
  inFlight: number;
}

/**
 * Queues deterministic terrain generation across a small pool of module workers.
 * ArrayBuffers are transferred rather than copied back to the main thread.
 */
export class ChunkPipeline {
  public readonly supported: boolean;
  private readonly workers: WorkerSlot[] = [];
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();

  constructor(
    private readonly seed: number,
    private readonly biomeSize: BiomeSize
  ) {
    this.supported = typeof Worker !== 'undefined';
    if (!this.supported) return;

    const cores = typeof navigator !== 'undefined' && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 2;
    const poolSize = Math.min(4, Math.max(1, cores - 1));

    for (let i = 0; i < poolSize; i++) {
      try {
        const worker = new Worker(new URL('./ChunkWorker.ts', import.meta.url), { type: 'module' });
        const slotIndex = this.workers.length;
        const slot: WorkerSlot = { worker, inFlight: 0 };
        worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
          const response = event.data;
          if (response.type !== 'generated') return;
          const pending = this.pending.get(response.requestId);
          if (!pending) return;
          this.pending.delete(response.requestId);
          slot.inFlight = Math.max(0, slot.inFlight - 1);
          pending.resolve({
            cx: response.cx,
            cz: response.cz,
            data: new Uint8Array(response.data),
          });
        });
        worker.addEventListener('error', (event) => {
          console.warn('[Caveria] Chunk worker failed; pending chunks will retry synchronously.', event.message);
          for (const [id, request] of this.pending) {
            if (request.workerIndex === slotIndex) {
              this.pending.delete(id);
              request.reject(new Error(event.message));
            }
          }
          worker.terminate();
          const idx = this.workers.indexOf(slot);
          if (idx !== -1) this.workers.splice(idx, 1);
        });
        this.workers.push(slot);
      } catch (error) {
        if (this.workers.length === 0) {
          console.warn('[Caveria] Web Worker unavailable; using synchronous chunk generation.', error);
        }
        break;
      }
    }
  }

  public get active(): boolean {
    return this.workers.length > 0;
  }

  public generate(cx: number, cz: number): Promise<GeneratedChunkData> {
    if (this.workers.length === 0) return Promise.reject(new Error('Chunk worker is unavailable'));

    // Pick the least-busy worker in the pool so terrain generation scales across cores.
    let bestIndex = 0;
    let bestLoad = this.workers[0].inFlight;
    for (let i = 1; i < this.workers.length; i++) {
      if (this.workers[i].inFlight < bestLoad) {
        bestLoad = this.workers[i].inFlight;
        bestIndex = i;
      }
    }

    const slot = this.workers[bestIndex];
    const requestId = this.nextRequestId++;
    slot.inFlight++;

    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { workerIndex: bestIndex, cx, cz, resolve, reject });
      slot.worker.postMessage({
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
