import fs from 'node:fs/promises';
import path from 'node:path';
import type { ConversationDetail } from '../sources/chatgpt/api/types.js';
import { buildFileMap } from './file-service.js';
import {
  buildFrontmatter,
  collectAllJsonFiles,
  isoOrNull,
  markdownFilename,
  relativeJsonFromMd,
} from '../utils/conversation-files.js';

interface MappingNode {
  id: string;
  message?: {
    id: string;
    author: { role: string };
    content?: {
      content_type: string;
      parts?: unknown[];
      text?: string;
    };
    weight?: number;
    metadata?: Record<string, unknown>;
  } | null;
  parent?: string | null;
  children?: string[];
}

export function extractTextFromParts(parts: unknown[], fileMap?: Map<string, string>): string {
  const pieces: string[] = [];
  for (const part of parts) {
    if (typeof part === 'string') {
      pieces.push(part);
    } else if (part && typeof part === 'object') {
      const obj = part as Record<string, unknown>;
      if (obj.content_type === 'image_asset_pointer') {
        const pointer = obj.asset_pointer as string | undefined;
        if (pointer && fileMap) {
          const fileId = pointer.startsWith('file-service://')
            ? pointer.slice('file-service://'.length)
            : null;
          if (fileId && fileMap.has(fileId)) {
            pieces.push(`![image](${fileMap.get(fileId)})`);
            continue;
          }
        }
        pieces.push(`![image](${pointer ?? 'unknown'})`);
      }
    }
  }
  return pieces.join('\n');
}

function getLinearThread(
  mapping: Record<string, MappingNode>,
  currentNode?: string | null
): MappingNode[] {
  if (currentNode && mapping[currentNode]) {
    const pathNodes: MappingNode[] = [];
    let nodeId: string | null | undefined = currentNode;
    while (nodeId && mapping[nodeId]) {
      pathNodes.unshift(mapping[nodeId]);
      nodeId = mapping[nodeId].parent;
    }
    return pathNodes;
  }

  let root: MappingNode | undefined;
  for (const node of Object.values(mapping)) {
    if (node.parent === null || node.parent === undefined) {
      root = node;
      break;
    }
  }
  if (!root) return [];

  const thread: MappingNode[] = [root];
  let current = root;
  while (current.children && current.children.length > 0) {
    const nextId = current.children[0];
    const next = mapping[nextId];
    if (!next) break;
    thread.push(next);
    current = next;
  }
  return thread;
}

function formatRole(role: string): string {
  switch (role) {
    case 'user':
      return 'User';
    case 'assistant':
      return 'Assistant';
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
}

export function convertConversation(
  detail: ConversationDetail,
  fileMap?: Map<string, string>,
  options: { conversationId?: string } = {}
): string {
  const id =
    options.conversationId ?? detail.conversation_id ?? detail.id ?? 'unknown';
  const title = detail.title ?? 'Untitled';
  const frontmatter = buildFrontmatter({
    id,
    title,
    updated: isoOrNull(detail.update_time),
    created: isoOrNull(detail.create_time),
    json: relativeJsonFromMd(id),
  });

  const lines: string[] = [frontmatter, '', `# ${title}`];

  const thread = getLinearThread(
    detail.mapping as unknown as Record<string, MappingNode>,
    detail.current_node
  );

  let firstMessage = true;
  for (const node of thread) {
    const msg = node.message;
    if (!msg) continue;

    const role = msg.author.role;
    if (role === 'system' || role === 'tool') continue;
    if (msg.metadata?.is_visually_hidden_from_conversation) continue;
    if (msg.weight === 0) continue;

    let text = '';
    if (msg.content) {
      if (msg.content.parts && msg.content.parts.length > 0) {
        text = extractTextFromParts(msg.content.parts, fileMap);
      } else if (msg.content.text) {
        text = msg.content.text;
      }
    }
    if (!text.trim()) continue;

    if (firstMessage) {
      lines.push('');
      firstMessage = false;
    } else {
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    lines.push(`**${formatRole(role)}:**`);
    lines.push('');
    lines.push(text);
  }

  lines.push('');
  return lines.join('\n');
}

/** Remove prior dated markdown for this id (title/date may have changed). */
async function removeStaleMarkdown(
  conversationsDir: string,
  conversationId: string,
  keepName: string
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(conversationsDir, { withFileTypes: true });
  } catch {
    return;
  }
  const needle = `id: ${conversationId}`;
  const needleQuoted = `id: "${conversationId}"`;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    if (entry.name === keepName) continue;
    const full = path.join(conversationsDir, entry.name);
    try {
      const head = await fs.readFile(full, 'utf-8');
      const fm = head.slice(0, 800);
      if (fm.includes(needle) || fm.includes(needleQuoted)) {
        await fs.unlink(full);
      }
    } catch {
      // ignore
    }
  }
  const legacySidecar = path.join(conversationsDir, `${conversationId}.md`);
  if (path.basename(legacySidecar) !== keepName) {
    await fs.unlink(legacySidecar).catch(() => undefined);
  }
}

const UUID_MD = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.md$/i;

/** Drop pre-layout markdown named only by conversation UUID. */
async function removeLegacyUuidMarkdown(conversationsDir: string): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(conversationsDir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isFile() && UUID_MD.test(entry.name)) {
      await fs.unlink(path.join(conversationsDir, entry.name)).catch(() => undefined);
    }
  }
}

export async function convertDirectory(
  inputDir: string,
  filesDir?: string
): Promise<{ converted: number; errors: number }> {
  const jsonFiles = await collectAllJsonFiles(inputDir);
  const globalFileMap = filesDir ? await buildFileMap(filesDir) : null;

  let converted = 0;
  let errors = 0;
  const touchedDirs = new Set<string>();

  for (const jsonPath of jsonFiles) {
    try {
      const raw = await fs.readFile(jsonPath, 'utf-8');
      const detail = JSON.parse(raw) as ConversationDetail;
      const id =
        detail.conversation_id ?? detail.id ?? path.basename(jsonPath, '.json');

      const conversationsDir = jsonPath.includes(`${path.sep}json${path.sep}`)
        ? path.dirname(path.dirname(jsonPath))
        : path.dirname(jsonPath);
      touchedDirs.add(conversationsDir);

      let fileMap: Map<string, string> | undefined;
      if (globalFileMap && globalFileMap.size > 0) {
        fileMap = new Map();
        for (const [fileId, filePath] of globalFileMap) {
          const absFilePath = path.join(inputDir, filePath);
          fileMap.set(fileId, path.relative(conversationsDir, absFilePath));
        }
      }

      const markdown = convertConversation(detail, fileMap, {
        conversationId: id,
      });
      const mdName = markdownFilename(detail);
      const mdPath = path.join(conversationsDir, mdName);
      await removeStaleMarkdown(conversationsDir, id, mdName);
      await fs.writeFile(mdPath, markdown, 'utf-8');
      converted++;
    } catch (err) {
      errors++;
      if (process.env.PROMPT_EXPORTER_DEBUG_MD === '1') {
        console.error(
          `markdown convert failed for ${jsonPath}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  for (const dir of touchedDirs) {
    await removeLegacyUuidMarkdown(dir);
  }

  return { converted, errors };
}
