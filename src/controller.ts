// Single source of truth the trees render. Owns refresh (read paths) and the
// run lifecycle (action path): stream stderr for advisory progress, poll
// costs/status on a fixed cadence for authoritative state, parse the end-only
// --json-result on exit.
import type { ChildProcessWithoutNullStreams } from "child_process";
import * as vscode from "vscode";

import { ACTIONS, SpecRunnerCli, parseRunResult } from "./cli";
import type { ResolvedConfig } from "./config";
import {
  summaryFromStatus,
  tasksFromCosts,
  type CostsPayload,
  type StatusPayload,
} from "./model";
import type { RunOutput } from "./output";
import { readStages } from "./specState";
import type { WorkspaceState } from "./types";

const STAGE_RE = /⏳ stage:\s*([^\s]+)/;
const POLL_MS = 4000;
const SIGKILL_GRACE_MS = 5000;

const EMPTY: WorkspaceState = {
  stages: [],
  tasks: [],
  summary: null,
  governance: null,
  running: false,
  activeTaskId: null,
  activeStage: null,
};

export class SpecRunnerController {
  private _state: WorkspaceState = EMPTY;
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  private activeChild: ChildProcessWithoutNullStreams | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private readOnly = false;

  constructor(
    private readonly cfg: ResolvedConfig,
    private readonly cli: SpecRunnerCli,
    private readonly output: RunOutput,
  ) {}

  get state(): WorkspaceState {
    return this._state;
  }

  setReadOnly(v: boolean): void {
    this.readOnly = v;
  }

  private emit(): void {
    this._onDidChange.fire();
  }

  /** Reload the read-model: stages from frontmatter, tasks/summary via CLI. */
  async refresh(): Promise<void> {
    const stages = readStages(this.cfg.specDir, this.cfg.specPrefix);
    let tasks = this._state.tasks;
    let summary = this._state.summary;

    if (!this.readOnly) {
      const costs = await this.cli.costsJson();
      if (costs.ok && costs.value) {
        tasks = tasksFromCosts(costs.value as CostsPayload);
      } else if (costs.errors) {
        this.output.line(`[refresh] costs --json: ${costs.errors}`);
      }
      const status = await this.cli.statusJson();
      if (status.ok && status.value) {
        summary = summaryFromStatus(status.value as StatusPayload);
      } else if (status.errors) {
        this.output.line(`[refresh] status --json: ${status.errors}`);
      }
    }

    this._state = {
      ...this._state,
      stages,
      tasks,
      summary,
      governance: this.cfg.governance,
    };
    this.emit();
  }

  isRunning(): boolean {
    return this.activeChild !== null;
  }

  /** Start a run (single task or all). One active process at a time. */
  async startRun(subcommand: string[], taskId: string | null): Promise<void> {
    if (this.activeChild) {
      void vscode.window.showWarningMessage("A spec-runner run is already active.");
      return;
    }
    this.output.show();
    this.output.line(`▶ spec-runner ${subcommand.join(" ")}`);

    const { child, done } = this.cli.runStreaming(subcommand, (line) => {
      this.output.line(line);
      const m = line.match(STAGE_RE);
      if (m) {
        this._state = { ...this._state, activeStage: m[1] };
        this.output.setActive(this._state.activeTaskId, m[1]);
        this.emit();
      }
    });

    this.activeChild = child;
    this._state = { ...this._state, running: true, activeTaskId: taskId, activeStage: null };
    this.output.setActive(taskId, null);
    this.emit();

    // Fixed-cadence authoritative poll (stderr is advisory only).
    this.pollTimer = setInterval(() => void this.refresh(), POLL_MS);

    try {
      const result = await done;
      if (result.code === 0) {
        const parsed = parseRunResult(result.stdout);
        if (!parsed.ok) {
          this.output.line(`[run] --json-result did not validate: ${parsed.errors}`);
        }
      } else {
        this.output.line(`[run] exited with code ${result.code}`);
        this.surfaceGateBlock(result.stdout + result.stderr);
      }
    } catch (e) {
      this.output.line(`[run] error: ${(e as Error).message}`);
    } finally {
      this.stopPolling();
      this.activeChild = null;
      this._state = { ...this._state, running: false, activeTaskId: null, activeStage: null };
      this.output.setActive(null, null);
      await this.refresh();
    }
  }

  runTask(id: string): Promise<void> {
    return this.startRun(ACTIONS.runTask(id), id);
  }

  runAll(): Promise<void> {
    return this.startRun(ACTIONS.runAll(), null);
  }

  /** Stop the active run: SIGTERM, then SIGKILL after a grace period. */
  stop(): void {
    const child = this.activeChild;
    if (!child) {
      return;
    }
    this.output.line("■ stopping (SIGTERM)…");
    child.kill("SIGTERM");
    setTimeout(() => {
      if (this.activeChild === child) {
        this.output.line("■ force killing (SIGKILL)…");
        child.kill("SIGKILL");
      }
    }, SIGKILL_GRACE_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** If a strict-governance gate blocked the run, surface it actionably. */
  private surfaceGateBlock(text: string): void {
    if (text.includes("⛔") && /governance/i.test(text)) {
      void vscode.window
        .showWarningMessage(
          "spec-runner blocked this run: tasks.md is not approved under strict governance.",
          "Approve tasks",
        )
        .then((choice) => {
          if (choice === "Approve tasks") {
            void vscode.commands.executeCommand("specRunner.approve", { stage: "tasks" });
          }
        });
    }
  }

  dispose(): void {
    this.stopPolling();
    this._onDidChange.dispose();
    if (this.activeChild) {
      this.activeChild.kill("SIGKILL");
    }
  }
}
