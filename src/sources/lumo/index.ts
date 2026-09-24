import type { Source } from '../types.js';
import { getSourceDataDir } from '../../utils/paths.js';

export const lumoSource: Source = {
  id: 'lumo',
  label: 'Lumo',
  description: 'lumo.proton.me (Proton) via Chromium CDP / in-app Redux',
  defaultDataDir() {
    return getSourceDataDir('lumo');
  },
};

export { exportLumoViaCdp } from './api/cdp-export.js';
export type { LumoExportBundle, LumoConversationDetail, LumoConversationItem } from './api/types.js';
