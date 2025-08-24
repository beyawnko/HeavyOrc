import { Expert } from '../types';

/**
 * Normalize various shapes to a consistent Expert object.
 * Accepts keys like id|key|slug|uuid and name|title|label.
 */
function normalizeExpert(raw: unknown): Expert | null {
  if (typeof raw !== 'object' || raw === null) return null;
  
  const rawObj = raw as Record<string, unknown>;

  const id =
    rawObj.id ??
    rawObj.key ??
    rawObj.slug ??
    rawObj.uuid ??
    (typeof rawObj.name === 'string' ? rawObj.name.toLowerCase().replace(/\s+/g, '-') : null) ??
    null;

  const name =
    rawObj.name ??
    rawObj.title ??
    rawObj.label ??
    (typeof rawObj.id === 'string' ? rawObj.id : null) ??
    null;
    
  const persona = rawObj.persona;

  if (typeof id !== 'string' || typeof name !== 'string' || typeof persona !== 'string' || !persona) {
    return null;
  }

  return { id, name, persona };
}


/**
 * Load, validate, and normalize experts from experts.json.
 * @returns {Promise<Array<Expert>>}
 */
export async function loadExperts(): Promise<Expert[]> {
  const url = './config/experts.json';
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch experts.json: ${response.status} ${response.statusText}`);
  }
  
  const json = await response.json();
  const arr: unknown[] = Array.isArray(json) ? json : (json && Array.isArray(json.experts) ? json.experts : []);

  const experts: Expert[] = [];
  for (const raw of arr) {
    const norm = normalizeExpert(raw);
    if (norm) {
      experts.push(norm);
    } else {
      console.warn('Skipping expert missing id, name, or persona:', raw);
    }
  }

  return experts;
}