/**
 * A prompt source (ChatGPT, future Claude, etc.).
 */
export type SourceId = string;

export interface SourceInfo {
  id: SourceId;
  label: string;
  description: string;
}

export interface Source extends SourceInfo {
  /** Default local data directory for this source */
  defaultDataDir(): string;
}
