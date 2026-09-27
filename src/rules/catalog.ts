import type { RulePack, RulePackId, RuleTemplate } from './types.js';
import {
  journalLoggingRule,
  plansLocationRule,
} from './templates/cursor.js';
import { parseCommaIds } from '../utils/parse-ids.js';

const packs: RulePack[] = [
  {
    id: 'cursor',
    label: 'Cursor',
    description:
      'Workspace rules that keep plans and journals under .cursor/ (not ~/.cursor)',
    rules: [plansLocationRule, journalLoggingRule],
  },
];

export function listRulePacks(): RulePack[] {
  return packs.map((p) => ({
    ...p,
    rules: [...p.rules],
  }));
}

export function getRulePack(id: string): RulePack {
  const pack = packs.find((p) => p.id === id);
  if (!pack) {
    const known = packs.map((p) => p.id).join(', ');
    throw new Error(`Unknown rule source "${id}". Available: ${known}`);
  }
  return pack;
}

export function resolveRulePackId(raw?: string): RulePackId {
  const id = (raw?.trim() || 'cursor') as RulePackId;
  getRulePack(id);
  return id;
}

/** Split CLI args that may be comma- and/or space-separated. */
export function parseRuleIds(raw: string[]): string[] {
  return parseCommaIds(raw);
}

export function resolveRules(
  pack: RulePack,
  requested: string[]
): RuleTemplate[] {
  if (requested.length === 0) {
    return [...pack.rules];
  }
  const byId = new Map(pack.rules.map((r) => [r.id, r]));
  const out: RuleTemplate[] = [];
  const missing: string[] = [];
  for (const id of requested) {
    const rule = byId.get(id);
    if (!rule) missing.push(id);
    else out.push(rule);
  }
  if (missing.length) {
    const known = pack.rules.map((r) => r.id).join(', ');
    throw new Error(
      `Unknown rule(s) for source "${pack.id}": ${missing.join(', ')}. Available: ${known}`
    );
  }
  return out;
}
