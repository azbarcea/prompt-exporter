import type { SkillAgent, SkillRegistry } from './types.js';

const DESTINATION_HINTS: Array<{ pattern: RegExp; agent: SkillAgent }> = [
  { pattern: /(^|[\\/])\.cursor([\\/]|$)/i, agent: 'cursor' },
  { pattern: /(^|[\\/])\.claude([\\/]|$)/i, agent: 'claude-code' },
  { pattern: /(^|[\\/])\.codex([\\/]|$)/i, agent: 'codex' },
  { pattern: /(^|[\\/])\.opencode([\\/]|$)/i, agent: 'opencode' },
  { pattern: /(^|[\\/])\.agents([\\/]|$)/i, agent: 'any' },
];

/** Infer target agent from install destination directory. */
export function agentFromDestination(destination: string): SkillAgent {
  const normalized = destination.replace(/\\/g, '/');
  for (const { pattern, agent } of DESTINATION_HINTS) {
    if (pattern.test(normalized)) return agent;
  }
  // Default project install path is Cursor
  if (!normalized || normalized === '.' || normalized.endsWith('cursor')) {
    return 'cursor';
  }
  return 'cursor';
}

export function registryAgents(registry: SkillRegistry): SkillAgent[] {
  const agents = registry.agents?.length ? registry.agents : (['any'] as SkillAgent[]);
  return [...new Set(agents)];
}

export function registrySupportsAgent(
  registry: SkillRegistry,
  agent: SkillAgent
): boolean {
  const agents = registryAgents(registry);
  if (agents.includes('any')) return true;
  if (agent === 'any') return true;
  return agents.includes(agent);
}

export function formatAgents(agents: SkillAgent[]): string {
  return agents.join(', ');
}

/**
 * Light conversion of SKILL.md for a destination agent (esp. Cursor).
 * Keeps body; normalizes frontmatter compatibility / path hints.
 */
export function convertSkillMarkdown(
  content: string,
  options: { agent: SkillAgent; skillId: string }
): string {
  const { agent, skillId } = options;
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return `---
name: ${skillId}
description: Converted skill for ${agent}
compatibility: ${agent}
---

${content.trim()}
`;
  }

  const front = match[1]!;
  let body = match[2] ?? '';
  const lines = front.split(/\r?\n/);
  const kept: string[] = [];
  let hasName = false;
  let hasDescription = false;
  let hasCompatibility = false;

  for (const line of lines) {
    const key = line.split(':')[0]?.trim().toLowerCase();
    if (key === 'name') {
      hasName = true;
      kept.push(line);
      continue;
    }
    if (key === 'description') {
      hasDescription = true;
      kept.push(line);
      continue;
    }
    if (key === 'compatibility') {
      hasCompatibility = true;
      const current = line.slice(line.indexOf(':') + 1).trim();
      const parts = new Set(
        current
          .split(/[,|]/)
          .map((p) => p.trim())
          .filter(Boolean)
      );
      parts.add(agent);
      kept.push(`compatibility: ${[...parts].join(', ')}`);
      continue;
    }
    kept.push(line);
  }

  if (!hasName) kept.unshift(`name: ${skillId}`);
  if (!hasDescription) {
    kept.push(`description: Skill ${skillId} (converted for ${agent})`);
  }
  if (!hasCompatibility) kept.push(`compatibility: ${agent}`);

  // Soft path remaps toward Cursor project skills when converting to cursor
  if (agent === 'cursor') {
    body = body
      .replace(/~\/\.claude\/skills/g, '.cursor/skills')
      .replace(/\.claude\/skills/g, '.cursor/skills')
      .replace(/~\/\.agents\/skills/g, '.cursor/skills');
  }

  return `---\n${kept.join('\n')}\n---\n${body.startsWith('\n') ? body : `\n${body}`}`;
}
