export const implementationPlan = Object.freeze({
  issueNumber: "1",
  title: "提取 https://quant-wiki.com/ 文章中所有的量化方案",
  designFile: "docs/design/ISSUE-1-quant-wiki-com.md",
  acceptanceCriteria: Object.freeze([
    "能获取数据",
    "能结构化数据",
    "能用数据调试多种策略",
    "能懂动态切换不同策略",
    "能回测数据",
    "能在线模拟盘测试数据"
  ])
});

export function getImplementationSummary() {
  return {
    issueNumber: implementationPlan.issueNumber,
    title: implementationPlan.title,
    designFile: implementationPlan.designFile,
    acceptanceCriteriaCount: implementationPlan.acceptanceCriteria.length,
    nextGate: "human-review"
  };
}
