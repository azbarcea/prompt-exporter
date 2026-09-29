import { DEFAULT_CDP_PORT } from '../../../utils/paths.js';
import { CopilotCdpSession } from './cdp-session.js';
import { conversationToDetail, overviewToItem } from './map.js';
import type {
  CopilotConversationDetail,
  CopilotConversationItem,
  CopilotExportBundle,
} from './types.js';

export type CopilotClientOptions = {
  cdpPort?: number;
  /** Min gap between Substrate calls (ms). Default 400. */
  delayMs?: number;
  verbose?: boolean;
};

export class CopilotClient {
  private session: CopilotCdpSession;
  private verbose: boolean;
  private ownsSession: boolean;

  constructor(
    session: CopilotCdpSession,
    options: { verbose?: boolean; ownsSession?: boolean } = {}
  ) {
    this.session = session;
    this.verbose = options.verbose ?? false;
    this.ownsSession = options.ownsSession ?? true;
  }

  static async connect(
    options: CopilotClientOptions = {}
  ): Promise<CopilotClient> {
    const session = await CopilotCdpSession.connect(
      options.cdpPort ?? DEFAULT_CDP_PORT,
      { minGapMs: options.delayMs ?? 400 }
    );
    return new CopilotClient(session, {
      verbose: options.verbose,
      ownsSession: true,
    });
  }

  async close(): Promise<void> {
    if (this.ownsSession) await this.session.close();
  }

  async listAllChats(
    onProgress?: (fetched: number) => void
  ): Promise<CopilotConversationItem[]> {
    const seen = new Set<string>();
    const out: CopilotConversationItem[] = [];
    let syncState: string | null | undefined = null;
    let page = 0;

    for (;;) {
      page++;
      const data = await this.session.getChats(syncState);
      const chats = data.chats ?? [];
      for (const chat of chats) {
        if (!chat?.conversationId || seen.has(chat.conversationId)) continue;
        seen.add(chat.conversationId);
        out.push(overviewToItem(chat));
      }
      onProgress?.(out.length);
      if (this.verbose) {
        console.error(
          `[copilot] GetChats page ${page}: ${chats.length} (total ${out.length})`
        );
      }
      syncState = data.syncState ?? null;
      if (chats.length === 0 || !syncState) break;
      // Substrate caps recent chats (~500); stop if we stop making progress
      if (page > 40) break;
    }

    return out;
  }

  async getConversationDetail(
    listMeta: CopilotConversationItem
  ): Promise<CopilotConversationDetail> {
    const raw = await this.session.getConversation(listMeta.id);
    return conversationToDetail(raw, listMeta);
  }

  async exportAll(
    options: {
      onListProgress?: (fetched: number) => void;
      onDownloadProgress?: (completed: number, total: number) => void;
    } = {}
  ): Promise<CopilotExportBundle> {
    const warnings: string[] = [];
    const conversations = await this.listAllChats(options.onListProgress);
    const details: CopilotConversationDetail[] = [];
    let completed = 0;

    for (const item of conversations) {
      try {
        details.push(await this.getConversationDetail(item));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warnings.push(`conversation ${item.id}: ${msg}`);
        if (this.verbose) console.error(`[copilot] ${msg}`);
      }
      completed++;
      options.onDownloadProgress?.(completed, conversations.length);
    }

    return { conversations, details, warnings };
  }
}
