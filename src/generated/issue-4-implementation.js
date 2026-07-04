export const implementationPlan = Object.freeze({
  issueNumber: "4",
  title: "将代码迁移到 TS",
  designFile: "docs/design/ISSUE-4-ts.md",
  acceptanceCriteria: Object.freeze([
    "保证脚本都能正常执行",
    "保证 Bun 执行一切正常"
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
