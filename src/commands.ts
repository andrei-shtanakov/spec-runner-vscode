// Command handlers: map GUI actions → SpecRunnerCli / controller, with a modal
// confirm wherever code executes or budget is spent.
import * as path from "path";
import * as vscode from "vscode";

import { ACTIONS, type SpecRunnerCli } from "./cli";
import type { ResolvedConfig } from "./config";
import type { SpecRunnerController } from "./controller";
import type { RunOutput } from "./output";
import { stageFileName } from "./specState";
import type { StageName } from "./types";

interface Deps {
  cfg: ResolvedConfig;
  cli: SpecRunnerCli;
  controller: SpecRunnerController;
  output: RunOutput;
  readOnly: () => boolean;
}

function stageOf(arg: unknown): StageName | null {
  const s = (arg as { stage?: string } | undefined)?.stage;
  return s === "requirements" || s === "design" || s === "tasks" ? s : null;
}

async function confirm(message: string): Promise<boolean> {
  const choice = await vscode.window.showWarningMessage(
    message,
    { modal: true, detail: "This executes code, may run git operations, and spends API budget." },
    "Proceed",
  );
  return choice === "Proceed";
}

function guardReadOnly(readOnly: () => boolean): boolean {
  if (readOnly()) {
    void vscode.window.showWarningMessage(
      "spec-runner is in read-only mode (binary missing or version below the pinned minimum).",
    );
    return true;
  }
  return false;
}

/** Run a CLI subcommand, surfacing a non-zero exit as a notification. */
async function runAndReport(deps: Deps, subcommand: string[], label: string): Promise<boolean> {
  const r = await deps.cli.run(subcommand);
  deps.output.line(`$ spec-runner ${subcommand.join(" ")}`);
  if (r.stdout.trim()) {
    deps.output.line(r.stdout.trim());
  }
  if (r.code !== 0) {
    const detail = (r.stderr || r.stdout).trim().split("\n").slice(-3).join("\n");
    void vscode.window.showErrorMessage(`${label} failed: ${detail || `exit ${r.code}`}`);
    return false;
  }
  return true;
}

export function registerCommands(context: vscode.ExtensionContext, deps: Deps): void {
  const { cfg, controller, output } = deps;
  const reg = (id: string, fn: (...a: unknown[]) => unknown) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  reg("specRunner.refresh", () => controller.refresh());

  reg("specRunner.approve", async (arg) => {
    const stage = stageOf(arg);
    if (!stage || guardReadOnly(deps.readOnly)) {
      return;
    }
    // approve re-validates from scratch; its rc is the source of truth.
    if (await runAndReport(deps, ACTIONS.approve(stage), `Approve ${stage}`)) {
      void vscode.window.showInformationMessage(`Approved ${stage}.`);
    }
    await controller.refresh();
  });

  reg("specRunner.reject", async (arg) => {
    const stage = stageOf(arg);
    if (!stage || guardReadOnly(deps.readOnly)) {
      return;
    }
    await runAndReport(deps, ACTIONS.reject(stage), `Reject ${stage}`);
    await controller.refresh();
  });

  const generate = async (arg: unknown, regenerate: boolean) => {
    const stage = stageOf(arg);
    if (!stage || guardReadOnly(deps.readOnly)) {
      return;
    }
    if (cfg.confirmBeforeGenerate && !(await confirm(`${regenerate ? "Regenerate" : "Generate"} the ${stage} stage?`))) {
      return;
    }
    let description: string | undefined;
    if (!regenerate) {
      description = await vscode.window.showInputBox({
        prompt: `Description for the ${stage} stage`,
        placeHolder: "What should this stage cover?",
      });
      if (description === undefined) {
        return; // cancelled
      }
    }
    output.show();
    await runAndReport(deps, ACTIONS.generate(stage, description), `Generate ${stage}`);
    await controller.refresh();
  };

  reg("specRunner.generate", (arg) => generate(arg, false));
  reg("specRunner.regenerate", (arg) => generate(arg, true));

  reg("specRunner.generateNext", async () => {
    // Next unresolved stage = first non-approved whose upstream is approved.
    const order: StageName[] = ["requirements", "design", "tasks"];
    const byStage = new Map(controller.state.stages.map((s) => [s.stage, s]));
    let target: StageName | null = null;
    let upstreamApproved = true;
    for (const st of order) {
      const info = byStage.get(st);
      if (info && info.status !== "approved" && upstreamApproved) {
        target = st;
        break;
      }
      upstreamApproved = info?.status === "approved";
    }
    if (!target) {
      void vscode.window.showInformationMessage("All stages are approved.");
      return;
    }
    await generate({ stage: target }, false);
  });

  reg("specRunner.edit", async (arg) => {
    const stage = stageOf(arg);
    if (!stage) {
      return;
    }
    const file = path.join(cfg.specDir, stageFileName(stage, cfg.specPrefix));
    await vscode.window.showTextDocument(vscode.Uri.file(file));
  });

  reg("specRunner.runTask", async (arg) => {
    const id = (arg as { task?: { id?: string } } | undefined)?.task?.id;
    if (!id || guardReadOnly(deps.readOnly)) {
      return;
    }
    if (cfg.confirmBeforeRun && !(await confirm(`Run ${id}?`))) {
      return;
    }
    await controller.runTask(id);
  });

  reg("specRunner.runAll", async () => {
    if (guardReadOnly(deps.readOnly)) {
      return;
    }
    if (cfg.confirmBeforeRun && !(await confirm("Run all ready tasks?"))) {
      return;
    }
    await controller.runAll();
  });

  reg("specRunner.stop", () => controller.stop());
  reg("specRunner.logs", () => output.show());

  // Refresh the cached validation verdict after a spec file is saved — a body
  // edit does NOT re-validate, so the frontmatter verdict would otherwise be stale.
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      const stage = stageForPath(cfg, doc.uri.fsPath);
      if (stage && !deps.readOnly()) {
        await deps.cli.run(ACTIONS.check(stage));
        await controller.refresh();
      }
    }),
  );
}

function stageForPath(cfg: ResolvedConfig, fsPath: string): StageName | null {
  for (const stage of ["requirements", "design", "tasks"] as StageName[]) {
    if (path.join(cfg.specDir, stageFileName(stage, cfg.specPrefix)) === fsPath) {
      return stage;
    }
  }
  return null;
}
