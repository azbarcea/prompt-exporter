import { ChatGPTClient } from './client.js';
import { discoverCdpPort, isCdpRunning } from '../../../utils/cdp.js';
import { loadSavedToken } from '../../../utils/credentials.js';
import { DEFAULT_CDP_PORT } from '../../../utils/paths.js';

export type CreateClientOptions = {
  token?: string;
  verbose?: boolean;
  /** Preferred CDP port; auto-discovers when default is idle */
  cdpPort?: number;
  /** Parallel Chromium tabs for CDP fetches (default 3) */
  cdpPoolSize?: number;
  /** Min ms between starting CDP requests (default 150) */
  cdpMinGapMs?: number;
  /** Prefer CDP browser session when available (default true) */
  preferCdp?: boolean;
};

/**
 * Prefer Chromium CDP (logged-in cookies) over Node Bearer requests.
 * Cloudflare blocks Node-side Authorization with HTTP 403.
 */
export async function createChatGptClient(
  options: CreateClientOptions = {}
): Promise<{ client: ChatGPTClient; mode: 'cdp' | 'token' }> {
  const preferCdp = options.preferCdp !== false;
  let port = options.cdpPort ?? DEFAULT_CDP_PORT;
  const poolSize = options.cdpPoolSize ?? 3;
  const minGapMs = options.cdpMinGapMs ?? 150;

  if (preferCdp) {
    if (!(await isCdpRunning(port))) {
      const found = await discoverCdpPort(port);
      if (found !== null) port = found;
    }
    if (await isCdpRunning(port)) {
      const client = new ChatGPTClient(options.token ?? '', {
        verbose: options.verbose,
        cdpPort: port,
        cdpPoolSize: poolSize,
        cdpMinGapMs: minGapMs,
      });
      return { client, mode: 'cdp' };
    }
  }

  const token =
    options.token?.trim() ||
    process.env.PROMPT_EXPORTER_CHATGPT_TOKEN?.trim() ||
    process.env.CHATGPT_TOKEN?.trim() ||
    (await loadSavedToken('chatgpt'));

  if (!token) {
    throw new Error(
      'No CDP browser and no access token. Run: prompt-exporter chromium start'
    );
  }

  return {
    client: new ChatGPTClient(token, { verbose: options.verbose }),
    mode: 'token',
  };
}
