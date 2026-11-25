import { Chunk } from './Chunk';
import { TerrainGen } from './TerrainGen';

interface GenerateRequest {
  type: 'generate';
  requestId: number;
  seed: number;
  cx: number;
  cz: number;
}

interface GenerateResponse {
  type: 'generated';
  requestId: number;
  cx: number;
  cz: number;
  data: ArrayBuffer;
}

// Avoid depending on Window or dedicated-worker ambient typings in the shared TS config.
const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<GenerateRequest>) => void) | null;
  postMessage: (message: GenerateResponse, transfer: Transferable[]) => void;
};

const generators = new Map<number, TerrainGen>();

workerScope.onmessage = (event): void => {
  const request = event.data;
  if (request.type !== 'generate') return;

  let generator = generators.get(request.seed);
  if (!generator) {
    generator = new TerrainGen(request.seed);
    generators.set(request.seed, generator);
  }

  const chunk = new Chunk(request.cx, request.cz);
  generator.populateChunk(chunk);
  const data = chunk.data.buffer as ArrayBuffer;
  workerScope.postMessage(
    {
      type: 'generated',
      requestId: request.requestId,
      cx: request.cx,
      cz: request.cz,
      data,
    },
    [data]
  );
};
