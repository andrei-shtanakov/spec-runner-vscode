import { describe, expect, it } from "vitest";

import {
  isRunnable,
  normalizeStatus,
  summaryFromStatus,
  tasksFromCosts,
  type CostsPayload,
  type StatusPayload,
} from "../src/model";
import type { CanonicalStatus } from "../src/types";

describe("normalizeStatus", () => {
  const cases: Array<[string, CanonicalStatus]> = [
    ["todo", "todo"],
    ["in_progress", "in_progress"],
    ["done", "done"],
    ["blocked", "blocked"],
    ["pending", "todo"],
    ["running", "in_progress"],
    ["success", "done"],
    ["failed", "blocked"],
    ["skipped", "done"],
    ["something-new", "unknown"],
  ];
  it.each(cases)("maps %s → %s", (raw, expected) => {
    expect(normalizeStatus(raw)).toBe(expected);
  });
});

describe("tasksFromCosts", () => {
  it("normalizes the mixed vocabulary and keeps the raw status", () => {
    const payload: CostsPayload = {
      tasks: [
        { task_id: "T1", name: "a", status: "success", cost: 1, attempts: 2 },
        { task_id: "T2", name: "b", status: "todo", cost: 0, attempts: 0 },
      ],
    };
    const items = tasksFromCosts(payload);
    expect(items[0]).toMatchObject({ id: "T1", status: "done", rawStatus: "success" });
    expect(items[1]).toMatchObject({ id: "T2", status: "todo", rawStatus: "todo" });
  });
});

describe("summaryFromStatus", () => {
  it("maps the flat aggregate", () => {
    const payload: StatusPayload = {
      total_tasks: 3,
      completed: 1,
      failed: 0,
      running: 1,
      not_started: 1,
      total_cost: 2.5,
      budget_usd: 10,
    };
    expect(summaryFromStatus(payload)).toEqual({
      totalTasks: 3,
      completed: 1,
      failed: 0,
      running: 1,
      notStarted: 1,
      totalCost: 2.5,
      budgetUsd: 10,
    });
  });
});

describe("isRunnable", () => {
  it("is true for todo/in_progress only", () => {
    const base = { id: "x", name: "n", rawStatus: "", cost: 0, attempts: 0 };
    expect(isRunnable({ ...base, status: "todo" })).toBe(true);
    expect(isRunnable({ ...base, status: "in_progress" })).toBe(true);
    expect(isRunnable({ ...base, status: "done" })).toBe(false);
    expect(isRunnable({ ...base, status: "blocked" })).toBe(false);
  });
});
