import type { Source } from '../types.js';
import { getSourceDataDir } from '../../utils/paths.js';

export const perplexitySource: Source = {
  id: 'perplexity',
  label: 'Perplexity',
  description:
    'perplexity.ai threads via internal REST API (CDP session cookies)',
  defaultDataDir() {
    return getSourceDataDir('perplexity');
  },
};

export { PerplexityClient } from './api/client.js';
export type {
  PerplexityExportBundle,
  PerplexityConversationDetail,
  PerplexityConversationItem,
} from './api/types.js';
