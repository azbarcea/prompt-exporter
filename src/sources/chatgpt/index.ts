import type { Source } from '../types.js';
import { getSourceDataDir } from '../../utils/paths.js';

export const chatgptSource: Source = {
  id: 'chatgpt',
  label: 'ChatGPT',
  description: 'chatgpt.com conversation history via Chromium CDP',
  defaultDataDir() {
    return getSourceDataDir('chatgpt');
  },
};

export { createChatGptClient } from './api/create-client.js';
export { ChatGPTClient } from './api/client.js';
export type { ClientOptions } from './api/client.js';
