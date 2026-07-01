// Builds the combined WorkspaceState the trees render, and owns the
// status-normalization layer. `costs --json` reports a MIXED status vocabulary
// (DB states for run tasks, tasks.md states otherwise); this maps both to the
// tree's canonical set with an explicit `unknown` fallback — never a silent drop.
import type {
  CanonicalStatus,
  StatusSummary,
  TaskItem,
} from "./types";

/** Map spec-runner's mixed status vocabulary → the canonical tree status. */
export function normalizeStatus(raw: string): CanonicalStatus {
  switch (raw) {
    // tasks.md vocabulary (already canonical)
    case "todo":
    case "in_progress":
    case "done":
    case "blocked":
      return raw;
    // DB vocabulary (spec_runner.state.TaskState)
    case "pending":
      return "todo";
    case "running":
      return "in_progress";
    case "success":
      return "done";
    case "failed":
      return "blocked";
    case "skipped":
      return "done";
    default:
      return "unknown";
  }
}

export interface CostsTask {
  task_id: string;
  name: string;
  status: string;
  cost: number;
  attempts: number;
}

export interface CostsPayload {
  tasks: CostsTask[];
}

/** Map a validated `costs --json` payload → normalized TaskItem[]. */
export function tasksFromCosts(payload: CostsPayload): TaskItem[] {
  return payload.tasks.map((t) => ({
    id: t.task_id,
    name: t.name,
    status: normalizeStatus(t.status),
    rawStatus: t.status,
    cost: t.cost,
    attempts: t.attempts,
  }));
}

export interface StatusPayload {
  total_tasks: number;
  completed: number;
  failed: number;
  running: number;
  not_started: number;
  total_cost: number;
  budget_usd: number | null;
}

/** Map a validated `status --json` payload → the RUN summary. */
export function summaryFromStatus(payload: StatusPayload): StatusSummary {
  return {
    totalTasks: payload.total_tasks,
    completed: payload.completed,
    failed: payload.failed,
    running: payload.running,
    notStarted: payload.not_started,
    totalCost: payload.total_cost,
    budgetUsd: payload.budget_usd,
  };
}

/** A task is "ready to run" when it has no unmet blockers — todo/in_progress. */
export function isRunnable(task: TaskItem): boolean {
  return task.status === "todo" || task.status === "in_progress";
}
