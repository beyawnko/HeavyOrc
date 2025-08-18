import { Expert } from '../moe/types';

/**
 * Normalize various shapes to a consistent Expert object.
 * Accepts keys like id|key|slug|uuid and name|title|label.
 */
function normalizeExpert(raw: any): Expert | null {
  if (!raw || typeof raw !== 'object') return null;

  const id =
    raw.id ??
    raw.key ??
    raw.slug ??
    raw.uuid ??
    (typeof raw.name === 'string' ? raw.name.toLowerCase().replace(/\s+/g, '-') : null) ??
    null;

  const name =
    raw.name ??
    raw.title ??
    raw.label ??
    (typeof raw.id === 'string' ? raw.id : null) ??
    null;
    
  const persona = raw.persona;

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
  const arr = Array.isArray(json) ? json : (json && Array.isArray(json.experts) ? json.experts : []);

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
