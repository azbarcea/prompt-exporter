/** Target AI coding agents / platforms a skill catalog is meant for. */
export type SkillAgent =
  | 'cursor'
  | 'claude-code'
  | 'codex'
  | 'opencode'
  | 'gitlab-duo'
  | 'copilot'
  | 'gemini-cli'
  | 'any';

/** Forge hosting a skills catalog. */
export type SkillHost = 'github' | 'gitlab' | 'codeberg';

/** A remote catalog of agent skills (SKILL.md trees). */
export type SkillRegistry = {
  id: string;
  label: string;
  description: string;
  /** Forge host (default: github) */
  host?: SkillHost;
  /**
   * Repository path on the host:
   * - github/codeberg: owner/repo
   * - gitlab: group/project or group/subgroup/project
   */
  github: string;
  /** Directory under the repo that holds skill folders (e.g. resources, skills) */
  skillsPath: string;
  /** Git ref (branch or tag); default main */
  ref: string;
  /**
   * When true, also discover skills one level deeper
   * (e.g. skills/engineering/tdd → id tdd).
   */
  nested?: boolean;
  /**
   * Agents / AIs this catalog primarily targets.
   * Include `any` when the Agent Skills format is broadly portable.
   */
  agents?: SkillAgent[];
  /** true for shipped defaults; false for user-added */
  builtin?: boolean;
};

export type SkillIndexEntry = {
  id: string;
  /** Path of the skill folder relative to repo root */
  path: string;
  description?: string;
};

export type SkillFile = {
  /** Path relative to the skill folder (e.g. SKILL.md, scripts/foo.sh) */
  relativePath: string;
  content: string;
};

export type SkillBundle = {
  id: string;
  registryId: string;
  files: SkillFile[];
};

export type InstallSkillResult = {
  id: string;
  path: string;
  status: 'created' | 'updated' | 'skipped';
  filesWritten: number;
  converted?: boolean;
};

export type RepoActivity = {
  /** ISO timestamp of last push / activity when known */
  pushedAt: string;
  /** Where the timestamp came from */
  source: 'git' | 'api' | 'cache';
};
