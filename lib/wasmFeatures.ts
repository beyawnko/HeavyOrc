import { simd, threads } from 'wasm-feature-detect';

const simdPromise = simd();
const threadsPromise = threads();

export async function wasmSupportsSimd(): Promise<boolean> {
  return await simdPromise;
}

export async function wasmSupportsThreads(): Promise<boolean> {
  return crossOriginIsolated && await threadsPromise;
}
