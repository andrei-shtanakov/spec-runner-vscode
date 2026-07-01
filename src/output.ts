// OutputChannel for streamed run logs + a status-bar item for the active run.
import * as vscode from "vscode";

export class RunOutput {
  private readonly channel: vscode.OutputChannel;
  private readonly statusBar: vscode.StatusBarItem;

  constructor() {
    this.channel = vscode.window.createOutputChannel("spec-runner");
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.command = "specRunner.stop";
  }

  show(): void {
    this.channel.show(true);
  }

  line(text: string): void {
    this.channel.appendLine(text);
  }

  setActive(taskId: string | null, stage: string | null): void {
    if (!taskId) {
      this.statusBar.hide();
      return;
    }
    const stageText = stage ? ` · ${stage}` : "";
    this.statusBar.text = `$(sync~spin) spec-runner: ${taskId}${stageText}`;
    this.statusBar.tooltip = "Click to stop the active spec-runner run";
    this.statusBar.show();
  }

  dispose(): void {
    this.channel.dispose();
    this.statusBar.dispose();
  }
}
