import type { Source, SourceId, SourceInfo } from './types.js';
import { chatgptSource } from './chatgpt/index.js';
import { lumoSource } from './lumo/index.js';

const sources: Source[] = [chatgptSource, lumoSource];

export function listSources(): SourceInfo[] {
  return sources.map(({ id, label, description }) => ({
    id,
    label,
    description,
  }));
}

export function getSource(id: SourceId): Source {
  const found = sources.find((s) => s.id === id);
  if (!found) {
    const known = sources.map((s) => s.id).join(', ');
    throw new Error(`Unknown source "${id}". Available: ${known}`);
  }
  return found;
}

export function resolveSourceId(raw?: string): SourceId {
  const id = raw?.trim() || 'chatgpt';
  getSource(id); // validate
  return id;
}
