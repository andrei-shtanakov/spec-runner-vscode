// Resolves extension settings + project layout into a concrete invocation.
// Honors custom state_file / spec_prefix / spec_governance from
// spec-runner.config.yaml rather than assuming default naming.
import * as fs from "fs";
import * as path from "path";
import { parse as parseYaml } from "yaml";
import * as vscode from "vscode";

import type { CliInvocation } from "./cli";

export interface ResolvedConfig {
  workspaceRoot: string;
  specDir: string;
  specPrefix: string;
  invocation: CliInvocation;
  /** Whether the resolved binary was found on disk (auto-detect hit). */
  binaryFound: boolean;
  statePath: string;
  governance: "strict" | "off" | null;
  confirmBeforeRun: boolean;
  confirmBeforeGenerate: boolean;
  ignoreVersionPin: boolean;
}

/** Split a possibly-multi-word command string into command + leading args. */
export function splitCommand(raw: string): { command: string; baseArgs: string[] } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  return { command: parts[0] ?? "spec-runner", baseArgs: parts.slice(1) };
}

function readConfigYaml(workspaceRoot: string): Record<string, unknown> | null {
  const p = path.join(workspaceRoot, "spec-runner.config.yaml");
  try {
    const loaded = parseYaml(fs.readFileSync(p, "utf8"));
    return loaded && typeof loaded === "object" ? (loaded as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function detectBinary(workspaceRoot: string): { command: string; baseArgs: string[]; found: boolean } {
  const venv = path.join(workspaceRoot, ".venv", "bin", "spec-runner");
  if (fs.existsSync(venv)) {
    return { command: venv, baseArgs: [], found: true };
  }
  // Fall back to PATH; `uv run` is available via the explicit setting.
  return { command: "spec-runner", baseArgs: [], found: false };
}

function resolveStatePath(
  workspaceRoot: string,
  specDir: string,
  specPrefix: string,
  cfg: Record<string, unknown> | null,
): string {
  const custom = cfg?.state_file ?? (cfg?.paths as Record<string, unknown> | undefined)?.state;
  if (typeof custom === "string" && custom) {
    return path.isAbsolute(custom) ? custom : path.join(workspaceRoot, custom);
  }
  return path.join(specDir, `.executor-${specPrefix}state.db`);
}

export function resolveConfig(folder: vscode.WorkspaceFolder): ResolvedConfig {
  const workspaceRoot = folder.uri.fsPath;
  const settings = vscode.workspace.getConfiguration("spec-runner", folder.uri);
  const cfg = readConfigYaml(workspaceRoot);

  const specPrefix =
    settings.get<string>("specPrefix") || (typeof cfg?.spec_prefix === "string" ? cfg.spec_prefix : "");
  const specDir = path.join(workspaceRoot, "spec");

  const pathSetting = settings.get<string>("path")?.trim() ?? "";
  const bin = pathSetting ? { ...splitCommand(pathSetting), found: true } : detectBinary(workspaceRoot);

  const governanceRaw = cfg?.spec_governance;
  const governance =
    governanceRaw === "strict" ? "strict" : governanceRaw === "off" ? "off" : null;

  return {
    workspaceRoot,
    specDir,
    specPrefix,
    invocation: {
      command: bin.command,
      baseArgs: bin.baseArgs,
      cwd: workspaceRoot,
      specPrefix,
    },
    binaryFound: bin.found,
    statePath: resolveStatePath(workspaceRoot, specDir, specPrefix, cfg),
    governance,
    confirmBeforeRun: settings.get<boolean>("confirmBeforeRun", true),
    confirmBeforeGenerate: settings.get<boolean>("confirmBeforeGenerate", true),
    ignoreVersionPin: settings.get<boolean>("ignoreVersionPin", false),
  };
}
