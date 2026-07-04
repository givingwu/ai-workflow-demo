import assert from "node:assert/strict";
import test from "node:test";

import { getImplementationSummary, implementationPlan } from "../../src/generated/issue-1-implementation.js";

test("issue 1 implementation scaffold captures acceptance criteria", () => {
  const summary = getImplementationSummary();

  assert.equal(summary.issueNumber, "1");
  assert.equal(summary.title, "提取 https://quant-wiki.com/ 文章中所有的量化方案");
  assert.equal(summary.acceptanceCriteriaCount, 6);
  assert.equal(summary.nextGate, "human-review");
  assert.deepEqual(implementationPlan.acceptanceCriteria, [
    "能获取数据",
    "能结构化数据",
    "能用数据调试多种策略",
    "能懂动态切换不同策略",
    "能回测数据",
    "能在线模拟盘测试数据",
  ]);
});
