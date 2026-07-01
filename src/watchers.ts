// File-watchers that drive the read-model. Governance comes from spec/*.md
// frontmatter; task/run state from the config-resolved state DB (+ WAL). Both
// debounced so WAL churn doesn't thrash the CLI.
import * as path from "path";
import * as vscode from "vscode";

import type { ResolvedConfig } from "./config";

const DEBOUNCE_MS = 400;

export function createWatchers(
  folder: vscode.WorkspaceFolder,
  cfg: ResolvedConfig,
  onChange: () => void,
): vscode.Disposable[] {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(onChange, DEBOUNCE_MS);
  };

  const specGlob = new vscode.RelativePattern(folder, "spec/*.md");
  const specWatcher = vscode.workspace.createFileSystemWatcher(specGlob);
  specWatcher.onDidChange(debounced);
  specWatcher.onDidCreate(debounced);
  specWatcher.onDidDelete(debounced);

  // Watch the resolved state DB + its WAL sidecar.
  const rel = path.relative(folder.uri.fsPath, cfg.statePath);
  const dbGlob = new vscode.RelativePattern(folder, `${rel}*`);
  const dbWatcher = vscode.workspace.createFileSystemWatcher(dbGlob);
  dbWatcher.onDidChange(debounced);
  dbWatcher.onDidCreate(debounced);

  return [specWatcher, dbWatcher, { dispose: () => timer && clearTimeout(timer) }];
}
