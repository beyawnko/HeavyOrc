/**
 * Chrome-specific memory usage information for JavaScript heaps.
 * Non-standard API: available in Chromium-based browsers only.
 */
interface PerformanceMemory {
  /** Bytes of JS heap used by the page */
  usedJSHeapSize: number;
  /** Maximum size of the JS heap in bytes */
  jsHeapSizeLimit: number;
  /** Total allocated heap size in bytes */
  totalJSHeapSize: number;
}

/**
 * Augments the global Performance interface with the optional `memory` field.
 * See https://developer.chrome.com/docs/devtools/performance/reference for details.
 */
interface Performance {
  memory?: PerformanceMemory;
}

