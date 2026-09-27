import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  getRulePack,
  parseRuleIds,
  resolveRules,
} from '../src/rules/catalog.js';
import { installRules } from '../src/rules/install.js';

describe('parseRuleIds', () => {
  it('splits commas and spaces, dedupes', () => {
    assert.deepEqual(parseRuleIds(['journal-logging,plans-location']), [
      'journal-logging',
      'plans-location',
    ]);
    assert.deepEqual(
      parseRuleIds(['journal-logging', 'plans-location', 'journal-logging']),
      ['journal-logging', 'plans-location']
    );
  });
});

describe('resolveRules', () => {
  it('defaults to all rules in the pack', () => {
    const pack = getRulePack('cursor');
    const rules = resolveRules(pack, []);
    assert.equal(rules.length, pack.rules.length);
    assert.ok(rules.some((r) => r.id === 'plans-location'));
    assert.ok(rules.some((r) => r.id === 'journal-logging'));
  });

  it('rejects unknown ids', () => {
    const pack = getRulePack('cursor');
    assert.throws(() => resolveRules(pack, ['nope']), /Unknown rule/);
  });
});

describe('installRules', () => {
  it('writes .mdc files and ensures companion dirs', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'pe-rules-'));
    try {
      const pack = getRulePack('cursor');
      const { destination, results } = await installRules({
        destination: '.cursor',
        rules: pack.rules,
        cwd: tmp,
      });

      assert.equal(destination, path.join(tmp, '.cursor'));
      assert.equal(results.length, 2);
      assert.ok(results.every((r) => r.status === 'created'));

      const plans = await fs.readFile(
        path.join(tmp, '.cursor/rules/plans-location.mdc'),
        'utf-8'
      );
      assert.match(plans, /alwaysApply: true/);
      assert.match(plans, /\.cursor\/plans\//);
      assert.match(plans, /YYYY-mm-dd-HHMM/);

      const journal = await fs.readFile(
        path.join(tmp, '.cursor/rules/journal-logging.mdc'),
        'utf-8'
      );
      assert.match(journal, /\.cursor\/journal\//);
      assert.match(journal, /Do not put secrets/);

      const plansStat = await fs.stat(path.join(tmp, '.cursor/plans'));
      const journalStat = await fs.stat(path.join(tmp, '.cursor/journal'));
      assert.ok(plansStat.isDirectory());
      assert.ok(journalStat.isDirectory());

      const again = await installRules({
        destination: '.cursor',
        rules: pack.rules,
        cwd: tmp,
      });
      assert.ok(again.results.every((r) => r.status === 'skipped'));

      const forced = await installRules({
        destination: '.cursor',
        rules: [pack.rules[0]!],
        force: true,
        cwd: tmp,
      });
      assert.equal(forced.results[0]?.status, 'updated');
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});
