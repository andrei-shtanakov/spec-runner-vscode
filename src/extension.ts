// Activation: resolve config, check binary + version pin, wire the CLI adapter,
// controller, three trees, watchers, and commands. MVP handles one active
// project (the first workspace folder that looks like a spec-runner project).
import * as semver from "semver";
import * as vscode from "vscode";

import { SpecRunnerCli } from "./cli";
import { registerCommands } from "./commands";
import { resolveConfig } from "./config";
import { SpecRunnerController } from "./controller";
import { RunOutput } from "./output";
import { minSpecRunnerVersion } from "./schemas";
import { SpecTreeProvider } from "./trees/specTree";
import { TasksTreeProvider } from "./trees/tasksTree";
import { RunTreeProvider } from "./trees/runTree";
import { createWatchers } from "./watchers";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    return;
  }

  const cfg = resolveConfig(folder);
  const output = new RunOutput();
  context.subscriptions.push(output);
  const cli = new SpecRunnerCli(cfg.invocation);

  const readOnlyFlag = { value: false };
  const readOnly = () => readOnlyFlag.value;

  const controller = new SpecRunnerController(cfg, cli, output);
  context.subscriptions.push(controller);

  // --- binary + version-pin gate -----------------------------------------
  await gateReadiness(cfg, cli, readOnlyFlag);
  controller.setReadOnly(readOnlyFlag.value);

  // --- trees --------------------------------------------------------------
  const specTree = new SpecTreeProvider(controller);
  const tasksTree = new TasksTreeProvider(controller);
  const runTree = new RunTreeProvider(controller);
  context.subscriptions.push(
    vscode.window.createTreeView("specRunner.spec", { treeDataProvider: specTree }),
    vscode.window.createTreeView("specRunner.tasks", { treeDataProvider: tasksTree }),
    vscode.window.createTreeView("specRunner.run", { treeDataProvider: runTree }),
  );

  // --- commands + watchers ------------------------------------------------
  registerCommands(context, { cfg, cli, controller, output, readOnly });
  context.subscriptions.push(...createWatchers(folder, cfg, () => void controller.refresh()));

  await controller.refresh();
}

async function gateReadiness(
  cfg: ReturnType<typeof resolveConfig>,
  cli: SpecRunnerCli,
  readOnlyFlag: { value: boolean },
): Promise<void> {
  const detected = await cli.version();
  if (detected === null) {
    readOnlyFlag.value = true;
    void vscode.window
      .showWarningMessage(
        "spec-runner binary not found — running read-only. Install it or set `spec-runner.path`.",
        "Open Settings",
      )
      .then((c) => {
        if (c === "Open Settings") {
          void vscode.commands.executeCommand("workbench.action.openSettings", "spec-runner.path");
        }
      });
    return;
  }

  const min = minSpecRunnerVersion();
  if (semver.valid(detected) && semver.lt(detected, min) && !cfg.ignoreVersionPin) {
    readOnlyFlag.value = true;
    void vscode.window.showWarningMessage(
      `spec-runner ${detected} is older than the required ${min}; running read-only. ` +
        "Upgrade spec-runner, or set `spec-runner.ignoreVersionPin` for local development.",
    );
  }
}

export function deactivate(): void {
  // Disposables handle teardown.
}
