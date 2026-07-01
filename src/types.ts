// Shared types for the extension. Kept vscode-free so the core modules that
// use them (cli, specState, model, schemas) stay unit-testable without a host.

/** Canonical task status the TASKS tree renders. */
export type CanonicalStatus =
  | "todo"
  | "in_progress"
  | "done"
  | "blocked"
  | "unknown";

/** Gated-spec stage names. */
export type StageName = "requirements" | "design" | "tasks";

/** One task row, normalized from `costs --json`. */
export interface TaskItem {
  id: string;
  name: string;
  /** Canonical status (see model.normalizeStatus). */
  status: CanonicalStatus;
  /** Raw status string as spec-runner emitted it (mixed vocabulary). */
  rawStatus: string;
  cost: number;
  attempts: number;
}

/** Run-level aggregate, from `status --json`. */
export interface StatusSummary {
  totalTasks: number;
  completed: number;
  failed: number;
  running: number;
  notStarted: number;
  totalCost: number;
  budgetUsd: number | null;
}

/** Governance state for one stage, read from frontmatter. */
export interface StageInfo {
  stage: StageName;
  /** draft | approved | stale, or "missing" when the file has no frontmatter/does not exist. */
  status: "draft" | "approved" | "stale" | "missing";
  version: number | null;
  /** pass | fail | warn | "" (cached verdict), or null when unknown. */
  validation: string | null;
  /** True when the file exists on disk (regardless of frontmatter). */
  exists: boolean;
  /** True when the file carries spec-runner frontmatter (managed). */
  managed: boolean;
}

/** Combined single-source state the trees render. */
export interface WorkspaceState {
  stages: StageInfo[];
  tasks: TaskItem[];
  summary: StatusSummary | null;
  governance: "strict" | "off" | null;
  running: boolean;
  activeTaskId: string | null;
  activeStage: string | null;
}
