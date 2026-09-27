export type RulePackId = 'cursor';

export type RuleTemplate = {
  /** Stable id used on the CLI (e.g. plans-location) */
  id: string;
  /** Filename under {destination}/rules/ */
  filename: string;
  /** Short blurb for --list */
  description: string;
  /** Full .mdc file body including YAML frontmatter */
  content: string;
  /** Directories to create under destination (e.g. plans, journal) */
  ensureDirs?: string[];
};

export type RulePack = {
  id: RulePackId;
  label: string;
  description: string;
  rules: RuleTemplate[];
};
