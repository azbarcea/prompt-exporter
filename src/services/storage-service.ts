import fs from 'node:fs/promises';
import path from 'node:path';
import type { ConversationItem, ConversationDetail } from '../sources/chatgpt/api/types.js';
import {
  conversationsRoot,
  indexPath,
  jsonDir,
  jsonPathForId,
} from '../utils/conversation-files.js';

export interface BackupMetadata {
  timestamp: string;
  totalConversations: number;
  successfulDownloads: number;
  failedDownloads: number;
  errors: Array<{ conversationId: string; error: string }>;
  failedFiles?: string[];
}

export class StorageService {
  private outputDir: string;
  private conversationsDir: string;

  constructor(outputDir: string, projectName?: string) {
    this.outputDir = outputDir;
    this.conversationsDir = conversationsRoot(outputDir, projectName);
  }

  getConversationsDir(): string {
    return this.conversationsDir;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(jsonDir(this.conversationsDir), { recursive: true });
    await this.migrateLegacyJson();
  }

  /** Move conversations/*.json → conversations/json/*.json (one-time). */
  private async migrateLegacyJson(): Promise<void> {
    let entries;
    try {
      entries = await fs.readdir(this.conversationsDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const from = path.join(this.conversationsDir, entry.name);
      const to = path.join(jsonDir(this.conversationsDir), entry.name);
      try {
        await fs.rename(from, to);
      } catch {
        // ignore collisions / races
      }
    }
  }

  async saveConversation(id: string, data: ConversationDetail): Promise<void> {
    const filePath = jsonPathForId(this.conversationsDir, id);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async saveIndex(conversations: ConversationItem[]): Promise<void> {
    const filePath = indexPath(this.conversationsDir);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(conversations, null, 2), 'utf-8');
  }

  async saveMetadata(metadata: BackupMetadata): Promise<void> {
    const filePath = path.join(this.outputDir, 'metadata.json');
    await fs.writeFile(filePath, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  async appendLog(message: string): Promise<void> {
    const filePath = path.join(this.outputDir, 'backup.log');
    const timestamp = new Date().toISOString();
    await fs.appendFile(filePath, `[${timestamp}] ${message}\n`, 'utf-8');
  }

  async conversationExists(id: string): Promise<boolean> {
    try {
      await fs.access(jsonPathForId(this.conversationsDir, id));
      return true;
    } catch {
      return false;
    }
  }

  async getExistingConversationUpdateTime(id: string): Promise<number | null> {
    try {
      const content = await fs.readFile(
        jsonPathForId(this.conversationsDir, id),
        'utf-8'
      );
      const data = JSON.parse(content) as ConversationDetail;
      return data.update_time ?? null;
    } catch {
      return null;
    }
  }

  getConversationPath(id: string): string {
    return jsonPathForId(this.conversationsDir, id);
  }
}
