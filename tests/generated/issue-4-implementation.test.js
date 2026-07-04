import assert from "node:assert/strict";
import test from "node:test";

import { getImplementationSummary, implementationPlan } from "../../src/generated/issue-4-implementation.js";

test("issue 4 implementation scaffold captures acceptance criteria", () => {
  const summary = getImplementationSummary();

  assert.equal(summary.issueNumber, "4");
  assert.equal(summary.title, "将代码迁移到 TS");
  assert.equal(summary.acceptanceCriteriaCount, 2);
  assert.equal(summary.nextGate, "human-review");
  assert.deepEqual(implementationPlan.acceptanceCriteria, [
    "保证脚本都能正常执行",
    "保证 Bun 执行一切正常",
  ]);
});
