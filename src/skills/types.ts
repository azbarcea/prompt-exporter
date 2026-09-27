/** A remote catalog of Cursor agent skills (GitHub repo of SKILL.md trees). */
export type SkillRegistry = {
  id: string;
  label: string;
  description: string;
  /** owner/repo */
  github: string;
  /** Directory under the repo that holds skill folders (e.g. resources) */
  skillsPath: string;
  /** Git ref (branch or tag); default main */
  ref: string;
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
};
