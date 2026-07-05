// SpecRunnerCli — a thin adapter over the spec-runner binary. All mutations and
// reads go through the CLI (never direct file/DB writes), so spec-runner stays
// authoritative. vscode-free: it takes a resolved invocation + cwd, so it can be
// unit-tested by mocking child_process.spawn.
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";

import {
  checkAgainst,
  validateCosts,
  validateJsonResult,
  validateStatus,
} from "./schemas";

/** A resolved binary invocation: `command` plus any leading args (e.g. `uv run spec-runner`). */
export interface CliInvocation {
  command: string;
  baseArgs: string[];
  cwd: string;
  specPrefix: string;
}

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Build the argv for a spec-runner subcommand. `--spec-prefix` is a top-level
 * global (defined on the parent parser), so it must precede the subcommand.
 * Pure function — the heart of the command→argv contract tests.
 */
export function buildArgs(
  baseArgs: string[],
  specPrefix: string,
  subcommand: string[],
): string[] {
  const prefix = specPrefix ? ["--spec-prefix", specPrefix] : [];
  return [...baseArgs, ...prefix, ...subcommand];
}

export const ACTIONS = {
  version: (): string[] => ["--version"],
  statusJson: (): string[] => ["status", "--json"],
  costsJson: (): string[] => ["costs", "--json"],
  approve: (stage: string): string[] => ["spec", "approve", stage],
  reject: (stage: string): string[] => ["spec", "reject", stage],
  check: (stage: string): string[] => ["spec", "check", stage],
  generate: (stage: string, description?: string, fromFile?: string): string[] => [
    "plan",
    "--gated",
    "--stage",
    stage,
    "--no-interactive",
    // `--from-file` and the positional description are mutually exclusive on
    // the CLI; when a file is given it wins.
    ...(fromFile ? ["--from-file", fromFile] : description ? [description] : []),
  ],
  runTask: (id: string): string[] => ["run", "--task", id, "--json-result"],
  runAll: (): string[] => ["run", "--all", "--json-result"],
} as const;

export class SpecRunnerCli {
  constructor(private readonly inv: CliInvocation) {}

  private argv(subcommand: string[]): string[] {
    return buildArgs(this.inv.baseArgs, this.inv.specPrefix, subcommand);
  }

  /** Run a subcommand to completion, buffering stdout/stderr. */
  run(subcommand: string[]): Promise<RunResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.inv.command, this.argv(subcommand), {
        cwd: this.inv.cwd,
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("error", reject);
      child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
    });
  }

  /**
   * Spawn a run, streaming stderr lines to `onStderrLine` (advisory progress /
   * `⏳ stage:` markers) while buffering stdout (the end-only `--json-result`).
   * Returns the child (for SIGTERM/stop) and a promise resolving on exit.
   */
  runStreaming(
    subcommand: string[],
    onStderrLine: (line: string) => void,
  ): { child: ChildProcessWithoutNullStreams; done: Promise<RunResult> } {
    const child = spawn(this.inv.command, this.argv(subcommand), {
      cwd: this.inv.cwd,
    });
    let stdout = "";
    let stderr = "";
    let stderrBuf = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => {
      const text = d.toString();
      stderr += text;
      stderrBuf += text;
      let nl: number;
      while ((nl = stderrBuf.indexOf("\n")) !== -1) {
        const line = stderrBuf.slice(0, nl);
        stderrBuf = stderrBuf.slice(nl + 1);
        if (line.trim()) {
          onStderrLine(line);
        }
      }
    });
    const done = new Promise<RunResult>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => {
        if (stderrBuf.trim()) {
          onStderrLine(stderrBuf);
        }
        resolve({ code: code ?? -1, stdout, stderr });
      });
    });
    return { child, done };
  }

  async version(): Promise<string | null> {
    try {
      // `--version` is a top-level flag; no spec-prefix needed.
      const r = await this.run(["--version"]);
      const m = r.stdout.trim().match(/spec-runner\s+(\S+)/);
      return m ? m[1] : null;
    } catch {
      return null;
    }
  }

  async statusJson(): Promise<ReturnType<typeof checkAgainst>> {
    const r = await this.run(ACTIONS.statusJson());
    return parseJsonResult(r.stdout, validateStatus);
  }

  async costsJson(): Promise<ReturnType<typeof checkAgainst>> {
    const r = await this.run(ACTIONS.costsJson());
    return parseJsonResult(r.stdout, validateCosts);
  }
}

/** Parse a JSON blob and validate it against a compiled schema validator. */
export function parseJsonResult(
  stdout: string,
  validate: typeof validateStatus,
): ReturnType<typeof checkAgainst> {
  let data: unknown;
  try {
    data = JSON.parse(stdout);
  } catch (e) {
    return { ok: false, value: null, errors: `invalid JSON: ${(e as Error).message}` };
  }
  return checkAgainst(validate, data);
}

/** Parse the end-only `--json-result` blob (single object or array). */
export function parseRunResult(stdout: string): ReturnType<typeof checkAgainst> {
  return parseJsonResult(stdout, validateJsonResult);
}
