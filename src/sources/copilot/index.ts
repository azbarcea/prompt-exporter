import type { Source } from '../types.js';
import { getSourceDataDir } from '../../utils/paths.js';

export const copilotSource: Source = {
  id: 'copilot',
  label: 'Microsoft 365 Copilot',
  description:
    'M365 Copilot Chat (m365.cloud.microsoft/chat) via Substrate API + Chromium CDP',
  defaultDataDir() {
    return getSourceDataDir('copilot');
  },
};

export { CopilotClient } from './api/client.js';
export type {
  CopilotExportBundle,
  CopilotConversationDetail,
  CopilotConversationItem,
} from './api/types.js';
export { COPILOT_HOME } from './api/endpoints.js';
