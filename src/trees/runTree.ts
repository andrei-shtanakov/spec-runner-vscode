// RUN TreeView: active task + advisory stage + authoritative summary/budget.
import * as vscode from "vscode";

import type { SpecRunnerController } from "../controller";

function row(label: string, value: string, icon: string): vscode.TreeItem {
  const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
  item.description = value;
  item.iconPath = new vscode.ThemeIcon(icon);
  return item;
}

export class RunTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private readonly controller: SpecRunnerController) {
    controller.onDidChange(() => this._onDidChange.fire());
  }

  getTreeItem(el: vscode.TreeItem): vscode.TreeItem {
    return el;
  }

  getChildren(): vscode.TreeItem[] {
    const s = this.controller.state;
    const items: vscode.TreeItem[] = [];

    items.push(
      row("Active", s.running ? (s.activeTaskId ?? "run") : "idle", s.running ? "sync~spin" : "circle-slash"),
    );
    if (s.activeStage) {
      items.push(row("Stage", `${s.activeStage} (advisory)`, "watch"));
    }
    if (s.summary) {
      const sum = s.summary;
      items.push(
        row("Progress", `${sum.completed} done · ${sum.failed} failed · ${sum.running} running`, "graph"),
      );
      items.push(row("Tasks", `${sum.totalTasks} total · ${sum.notStarted} not started`, "list-tree"));
      const budget =
        sum.budgetUsd !== null
          ? `$${sum.totalCost.toFixed(2)} / $${sum.budgetUsd.toFixed(2)}`
          : `$${sum.totalCost.toFixed(2)}`;
      items.push(row("Budget", budget, "credit-card"));
    } else {
      items.push(row("Summary", "run `status --json` unavailable", "info"));
    }
    return items;
  }
}
