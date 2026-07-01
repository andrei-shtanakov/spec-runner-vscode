// SPEC governance TreeView. Renders per-stage draft/approved/stale + version +
// validation, with context-sensitive inline buttons encoded via contextValue.
import * as vscode from "vscode";

import type { SpecRunnerController } from "../controller";
import type { StageInfo, StageName } from "../types";

const UPSTREAM: Record<StageName, StageName | null> = {
  requirements: null,
  design: "requirements",
  tasks: "design",
};

export class SpecStageItem extends vscode.TreeItem {
  constructor(
    public readonly stage: StageName,
    info: StageInfo,
    upstreamApproved: boolean,
  ) {
    super(stage, vscode.TreeItemCollapsibleState.None);

    const bits: string[] = [];
    if (info.version !== null) {
      bits.push(`v${info.version}`);
    }
    bits.push(info.status);
    if (info.validation) {
      bits.push(`validation=${info.validation}`);
    }
    this.description = bits.join(" · ");
    this.iconPath = iconFor(info);
    this.contextValue = contextValue(info, upstreamApproved);
    this.tooltip = `${stage}: ${info.status}${
      info.validation ? ` (validation ${info.validation})` : ""
    }`;
  }
}

class GovernanceItem extends vscode.TreeItem {
  constructor(governance: "strict" | "off" | null) {
    super(`governance: ${governance ?? "unknown"}`, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(governance === "strict" ? "shield" : "unlock");
    this.contextValue = "governance";
  }
}

function iconFor(info: StageInfo): vscode.ThemeIcon {
  if (!info.exists || info.status === "missing") {
    return new vscode.ThemeIcon("circle-outline");
  }
  switch (info.status) {
    case "approved":
      return new vscode.ThemeIcon("check", new vscode.ThemeColor("charts.green"));
    case "stale":
      return new vscode.ThemeIcon("warning", new vscode.ThemeColor("charts.yellow"));
    default:
      return new vscode.ThemeIcon("edit");
  }
}

function contextValue(info: StageInfo, upstreamApproved: boolean): string {
  const tokens = ["stage"];
  if (info.exists) {
    tokens.push("canEdit");
  }
  const editable = info.status === "draft" || info.status === "stale";
  if (editable && info.validation !== "fail") {
    tokens.push("canApprove");
  }
  if (editable && info.managed) {
    tokens.push("canReject");
  }
  if (info.exists && info.status !== "approved") {
    tokens.push("canRegenerate");
  }
  if (info.status === "missing" && upstreamApproved) {
    tokens.push("canGenerate");
  }
  return tokens.join(" ");
}

export class SpecTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private readonly controller: SpecRunnerController) {
    controller.onDidChange(() => this._onDidChange.fire());
  }

  getTreeItem(el: vscode.TreeItem): vscode.TreeItem {
    return el;
  }

  getChildren(): vscode.TreeItem[] {
    const { stages, governance } = this.controller.state;
    const byStage = new Map(stages.map((s) => [s.stage, s]));
    const items: vscode.TreeItem[] = [new GovernanceItem(governance)];
    for (const info of stages) {
      const up = UPSTREAM[info.stage];
      const upstreamApproved = up === null || byStage.get(up)?.status === "approved";
      items.push(new SpecStageItem(info.stage, info, upstreamApproved));
    }
    return items;
  }
}
