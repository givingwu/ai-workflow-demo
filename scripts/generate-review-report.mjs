import { execFileSync } from "node:child_process";

const baseSha = process.env.BASE_SHA;
const headSha = process.env.HEAD_SHA ?? "HEAD";
const changedFiles = getChangedFiles(baseSha, headSha);

const hasSourceChange = changedFiles.some((file) => file.startsWith("src/"));
const hasTestChange = changedFiles.some((file) => file.startsWith("tests/"));
const hasDocsChange = changedFiles.some((file) => file.startsWith("docs/") || file === "README.md");
const hasWorkflowChange = changedFiles.some((file) => file.startsWith(".github/workflows/"));

console.log("## AI Review Report");
console.log("");
console.log("这是一个不依赖外部模型的结构化 review 报告，用于验证 PR 自动检查闭环。");
console.log("");
console.log("### 变更文件");
console.log("");

if (changedFiles.length === 0) {
  console.log("- 未检测到文件变更。");
} else {
  for (const file of changedFiles) {
    console.log(`- \`${file}\``);
  }
}

console.log("");
console.log("### 检查项");
console.log("");
console.log(`- ${hasSourceChange ? "✅" : "ℹ️"} 源码变更`);
console.log(`- ${hasTestChange ? "✅" : "⚠️"} 测试变更`);
console.log(`- ${hasDocsChange ? "✅" : "⚠️"} 文档变更`);
console.log(`- ${hasWorkflowChange ? "✅" : "ℹ️"} GitHub Actions 变更`);
console.log("");

if (hasSourceChange && !hasTestChange) {
  console.log("### 需要人工关注");
  console.log("");
  console.log("- 本 PR 修改了源码，但没有修改测试。请确认是否已有测试覆盖或补充说明。");
}

console.log("");
console.log("### 建议");
console.log("");
console.log("- 合并前确认 `npm test` 已通过。");
console.log("- 如果涉及行为变化，请确认 Issue 验收标准已被逐项覆盖。");

function getChangedFiles(base, head) {
  if (!base) {
    return [];
  }

  const output = execFileSync("git", ["diff", "--name-only", `${base}...${head}`], {
    encoding: "utf8"
  });

  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
