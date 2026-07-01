// TASKS TreeView, backed by `costs --json` (normalized in model.ts).
import * as vscode from "vscode";

import type { SpecRunnerController } from "../controller";
import { isRunnable } from "../model";
import type { CanonicalStatus, TaskItem } from "../types";

const STATUS_ICON: Record<CanonicalStatus, string> = {
  todo: "circle-outline",
  in_progress: "sync",
  done: "pass-filled",
  blocked: "error",
  unknown: "question",
};

export class TaskTreeItem extends vscode.TreeItem {
  constructor(public readonly task: TaskItem) {
    super(`${task.id}: ${task.name}`, vscode.TreeItemCollapsibleState.None);
    this.description = task.rawStatus;
    this.iconPath = new vscode.ThemeIcon(STATUS_ICON[task.status]);
    this.contextValue = isRunnable(task) ? "task canRun" : "task";
    this.tooltip =
      `${task.id} — ${task.status}` +
      (task.rawStatus !== task.status ? ` (raw: ${task.rawStatus})` : "") +
      (task.cost ? ` · $${task.cost.toFixed(2)}` : "");
  }
}

export class TasksTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private readonly controller: SpecRunnerController) {
    controller.onDidChange(() => this._onDidChange.fire());
  }

  getTreeItem(el: vscode.TreeItem): vscode.TreeItem {
    return el;
  }

  getChildren(): vscode.TreeItem[] {
    const { tasks } = this.controller.state;
    if (tasks.length === 0) {
      const empty = new vscode.TreeItem("No tasks", vscode.TreeItemCollapsibleState.None);
      empty.iconPath = new vscode.ThemeIcon("info");
      return [empty];
    }
    return tasks.map((t) => new TaskTreeItem(t));
  }
}
