
import { loadExperts } from '../lib/loadExperts';
import { Expert } from './types';

let loadedExperts: Expert[];

try {
  // This top-level await ensures the module waits for the config to load
  // before being made available to other modules that import it.
  loadedExperts = await loadExperts();
} catch (error) {
  console.error("Fatal: Could not load experts configuration. The application will run with no agents.", error);
  // Fallback to an empty array to prevent the application from crashing.
  loadedExperts = [];
}

// The full list of available experts, now loaded asynchronously.
export const experts: Expert[] = loadedExperts;

/**
 * Selects a specified number of experts from the available list.
 * This implementation uses a simple slice for simplicity, but could be
 * extended to use more complex selection logic (e.g., shuffling).
 * @param count The number of experts to select.
 * @returns An array of selected experts.
 */
export const getExperts = (count: number): Expert[] => {
  if (count > experts.length) {
    console.warn(`Requested ${count} experts, but only ${experts.length} are available. Returning all available experts.`);
    return experts;
  }
  // Simple selection: take the first 'count' experts.
  return experts.slice(0, count);
};
