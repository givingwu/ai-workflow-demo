import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveAiExecutionPolicy } from "./ai-execution-policy.mjs";

const IMPLEMENT_COMMAND = /^\/ai implement(?:\s|$)/i;
const ALLOWED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export async function createImplementationArtifacts({
  event,
  workspace = process.cwd(),
  tempDir = process.env.RUNNER_TEMP ?? path.join(workspace, ".tmp")
}) {
  if (event.issue?.pull_request) {
    return {
      implemented: false,
      reason: "comment belongs to a pull request"
    };
  }

  const commentBody = String(event.comment?.body ?? "").trim();
  if (!IMPLEMENT_COMMAND.test(commentBody)) {
    return {
      implemented: false,
      reason: "comment is not an implementation command"
    };
  }

  const authorAssociation = event.comment?.author_association;
  if (!ALLOWED_ASSOCIATIONS.has(authorAssociation)) {
    throw new Error("只有 OWNER、MEMBER 或 COLLABORATOR 可以批准 AI 进入实现阶段");
  }

  const issueNumber = String(event.issue.number);
  const issueTitle = normalizeTitle(event.issue.title);
  const commentId = String(event.comment.id);
  const sections = parseIssueSections(event.issue.body ?? "");
  const aiExecutionPolicy = resolveAiExecutionPolicy(sections);

  if (!aiExecutionPolicy.canCreateBranch) {
    return {
      implemented: false,
      issueNumber,
      aiExecutionLevel: aiExecutionPolicy.aiExecutionLevel,
      createPullRequest: false,
      reason: aiExecutionPolicy.blockedReason
    };
  }

  const slug = slugify(issueTitle, `issue-${issueNumber}`);
  const designFile = await findDesignFile({ workspace, issueNumber });
  const implementationFile = `docs/implementation/ISSUE-${issueNumber}-${slug}.md`;
  const sourceFile = `src/generated/issue-${issueNumber}-implementation.js`;
  const testFile = `tests/generated/issue-${issueNumber}-implementation.test.js`;
  const prBodyFile = path.join(tempDir, `issue-${issueNumber}-implementation-pr-body.md`);
  const branch = `ai/implement-issue-${issueNumber}-${commentId}`;
  const acceptanceCriteria = parseChecklist(sectionOrFallback(sections, "验收标准"));

  await mkdir(path.dirname(path.join(workspace, implementationFile)), { recursive: true });
  await mkdir(path.dirname(path.join(workspace, sourceFile)), { recursive: true });
  await mkdir(path.dirname(path.join(workspace, testFile)), { recursive: true });
  await mkdir(path.dirname(prBodyFile), { recursive: true });

  await writeFile(
    path.join(workspace, implementationFile),
    buildImplementationDocument({
      issueNumber,
      issueTitle,
      issueUrl: event.issue.html_url,
      designFile,
      sections,
      acceptanceCriteria,
      approver: event.comment.user?.login ?? "unknown",
      commentUrl: event.comment.html_url
    }),
    "utf8"
  );
  await writeFile(
    path.join(workspace, sourceFile),
    buildSourceFile({
      issueNumber,
      issueTitle,
      designFile,
      acceptanceCriteria
    }),
    "utf8"
  );
  await writeFile(
    path.join(workspace, testFile),
    buildGeneratedTestFile({
      issueNumber,
      issueTitle,
      sourceFile,
      acceptanceCriteria
    }),
    "utf8"
  );
  await writeFile(
    prBodyFile,
    buildPullRequestBody({
      issueNumber,
      issueTitle,
      designFile,
      implementationFile,
      sourceFile,
      testFile,
      approver: event.comment.user?.login ?? "unknown",
      commentUrl: event.comment.html_url
    }),
    "utf8"
  );

  return {
    implemented: true,
    issueNumber,
    aiExecutionLevel: aiExecutionPolicy.aiExecutionLevel,
    createPullRequest: aiExecutionPolicy.canCreatePullRequest,
    branch,
    designFile,
    implementationFile,
    sourceFile,
    testFile,
    prBodyFile,
    commitMessage: `feat: implement issue #${issueNumber} workflow scaffold`,
    prTitle: `[ai] Implement #${issueNumber} ${issueTitle}`
  };
}

async function findDesignFile({ workspace, issueNumber }) {
  const designDir = path.join(workspace, "docs/design");
  let entries;
  try {
    entries = await readdir(designDir);
  } catch {
    throw new Error(`缺少已合并设计文档：docs/design/ISSUE-${issueNumber}-*.md`);
  }

  const designFile = entries
    .filter((entry) => entry.startsWith(`ISSUE-${issueNumber}-`) && entry.endsWith(".md"))
    .sort()[0];
  if (!designFile) {
    throw new Error(`缺少已合并设计文档：docs/design/ISSUE-${issueNumber}-*.md`);
  }

  return `docs/design/${designFile}`;
}

function parseIssueSections(body) {
  const sections = {};
  let currentTitle = "说明";
  let currentLines = [];

  for (const line of body.split("\n")) {
    const match = line.match(/^###\s+(.+?)\s*$/);
    if (match) {
      sections[currentTitle] = currentLines.join("\n").trim();
      currentTitle = match[1].trim();
      currentLines = [];
      continue;
    }
    currentLines.push(line);
  }

  sections[currentTitle] = currentLines.join("\n").trim();
  delete sections["说明"];
  return sections;
}

function parseChecklist(value) {
  return String(value)
    .split("\n")
    .map((line) => line.match(/^-\s+\[[ xX]\]\s+(.+?)\s*$/)?.[1])
    .filter(Boolean);
}

function buildImplementationDocument({
  issueNumber,
  issueTitle,
  issueUrl,
  designFile,
  sections,
  acceptanceCriteria,
  approver,
  commentUrl
}) {
  const goal = sectionOrFallback(sections, "目标");
  const impact = sectionOrFallback(sections, "影响范围");

  return [
    `# ISSUE-${issueNumber}: ${issueTitle} 实现记录`,
    "",
    "## 来源",
    "",
    `- Issue: ${issueUrl ?? `#${issueNumber}`}`,
    `- 设计文档：${designFile}`,
    "",
    "## 实现目标",
    "",
    goal,
    "",
    "## 影响范围",
    "",
    impact,
    "",
    "## 验收标准映射",
    "",
    ...acceptanceCriteria.map((item) => `- [ ] ${item}`),
    "",
    "## 本次实现",
    "",
    "- 生成可审查的实现说明。",
    "- 生成 issue-scoped 的实现状态模块。",
    "- 生成对应的自动化测试，确保实现 PR 进入 CI / AI Review 闭环。",
    "",
    "## Human Approval Gateway",
    "",
    `- Approver: @${approver}`,
    commentUrl ? `- Approval comment: ${commentUrl}` : "- Approval comment: unavailable",
    ""
  ].join("\n");
}

function buildSourceFile({ issueNumber, issueTitle, designFile, acceptanceCriteria }) {
  return [
    "export const implementationPlan = Object.freeze({",
    `  issueNumber: ${JSON.stringify(issueNumber)},`,
    `  title: ${JSON.stringify(issueTitle)},`,
    `  designFile: ${JSON.stringify(designFile)},`,
    `  acceptanceCriteria: Object.freeze(${JSON.stringify(acceptanceCriteria, null, 2).replaceAll("\n", "\n  ")})`,
    "});",
    "",
    "export function getImplementationSummary() {",
    "  return {",
    "    issueNumber: implementationPlan.issueNumber,",
    "    title: implementationPlan.title,",
    "    designFile: implementationPlan.designFile,",
    "    acceptanceCriteriaCount: implementationPlan.acceptanceCriteria.length,",
    '    nextGate: "human-review"',
    "  };",
    "}",
    ""
  ].join("\n");
}

function buildGeneratedTestFile({ issueNumber, issueTitle, sourceFile, acceptanceCriteria }) {
  const importPath = path
    .relative("tests/generated", sourceFile)
    .replaceAll(path.sep, "/")
    .replace(/\.js$/, ".js");

  return [
    'import assert from "node:assert/strict";',
    'import test from "node:test";',
    "",
    `import { getImplementationSummary, implementationPlan } from "${importPath.startsWith(".") ? importPath : `./${importPath}`}";`,
    "",
    `test("issue ${issueNumber} implementation scaffold captures acceptance criteria", () => {`,
    "  const summary = getImplementationSummary();",
    "",
    `  assert.equal(summary.issueNumber, ${JSON.stringify(issueNumber)});`,
    `  assert.equal(summary.title, ${JSON.stringify(issueTitle)});`,
    `  assert.equal(summary.acceptanceCriteriaCount, ${acceptanceCriteria.length});`,
    '  assert.equal(summary.nextGate, "human-review");',
    "  assert.deepEqual(implementationPlan.acceptanceCriteria, [",
    ...acceptanceCriteria.map((item) => `    ${JSON.stringify(item)},`),
    "  ]);",
    "});",
    ""
  ].join("\n");
}

function buildPullRequestBody({
  issueNumber,
  issueTitle,
  designFile,
  implementationFile,
  sourceFile,
  testFile,
  approver,
  commentUrl
}) {
  return [
    "## 变更说明",
    "",
    `- 根据 Issue #${issueNumber} 的 /ai implement 指令生成实现 PR。`,
    `- 设计文档：\`${designFile}\``,
    `- 实现记录：\`${implementationFile}\``,
    `- 实现模块：\`${sourceFile}\``,
    `- 自动化测试：\`${testFile}\``,
    "",
    "## 关联任务",
    "",
    `Refs #${issueNumber}`,
    "",
    "## Human Approval Gateway",
    "",
    `- Approver: @${approver}`,
    commentUrl ? `- Approval comment: ${commentUrl}` : "- Approval comment: unavailable",
    "",
    "## 验证",
    "",
    "- [ ] CI 通过",
    "- [ ] AI Review 已回写",
    "- [ ] 人工 review 实现范围",
    "",
    "## 风险",
    "",
    `- 当前 PR 是 #${issueNumber} ${issueTitle} 的首个实现脚手架，后续可继续拆分真实业务子任务。`
  ].join("\n");
}

function sectionOrFallback(sections, title) {
  return sections[title]?.trim() || "_Issue 未提供该部分内容。_";
}

function normalizeTitle(title) {
  return String(title ?? "Untitled").replace(/^\[[^\]]+\]:\s*/, "").trim() || "Untitled";
}

function slugify(value, fallback) {
  const slug = value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  return slug || fallback;
}
