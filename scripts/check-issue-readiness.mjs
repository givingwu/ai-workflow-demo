import { readFile } from "node:fs/promises";

const eventPath = process.argv[2];
const event = JSON.parse(await readFile(eventPath, "utf8"));
const issue = event.issue;
const body = issue.body ?? "";

const requiredSections = [
  "背景",
  "目标",
  "不做什么",
  "验收标准",
  "影响范围",
  "AI 可执行等级"
];

const missingSections = requiredSections.filter((section) => !body.includes(section));
const hasAcceptanceChecklist = /- \[[ xX]\] .+/.test(body);
const isReady = missingSections.length === 0 && hasAcceptanceChecklist;

console.log("## AI Readiness Report");
console.log("");
console.log(`Issue: #${issue.number} ${issue.title}`);
console.log("");

if (isReady) {
  console.log("状态：可以进入 `AI Ready`。");
} else {
  console.log("状态：还不能进入 `AI Ready`。");
}

console.log("");
console.log("### 检查结果");
console.log("");

for (const section of requiredSections) {
  const marker = missingSections.includes(section) ? "❌" : "✅";
  console.log(`- ${marker} ${section}`);
}

console.log(`- ${hasAcceptanceChecklist ? "✅" : "❌"} 验收标准 checklist`);
console.log("");

if (!isReady) {
  console.log("### 需要补充");
  console.log("");
  for (const section of missingSections) {
    console.log(`- 补充「${section}」部分。`);
  }
  if (!hasAcceptanceChecklist) {
    console.log("- 验收标准需要使用 `- [ ]` checklist。");
  }
}

console.log("");
console.log("### Human Approval Gateway");
console.log("");
console.log("如果信息完整并同意 AI 继续，请回复：");
console.log("");
console.log("```text");
console.log("/ai approve");
console.log("```");
