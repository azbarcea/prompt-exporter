/** Split CLI args that may be comma- and/or space-separated. */
export function parseCommaIds(raw: string[]): string[] {
  const ids: string[] = [];
  for (const part of raw) {
    for (const piece of part.split(/[,]+/)) {
      const id = piece.trim();
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)];
}
