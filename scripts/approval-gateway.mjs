import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const APPROVAL_COMMAND = /^\/ai approve(?:\s|$)/i;
const ALLOWED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export async function createApprovalArtifacts({ event, workspace = process.cwd() }) {
  if (event.issue?.pull_request) {
    return {
      approved: false,
      reason: "comment belongs to a pull request"
    };
  }

  const commentBody = String(event.comment?.body ?? "").trim();
  if (!APPROVAL_COMMAND.test(commentBody)) {
    return {
      approved: false,
      reason: "comment is not an approval command"
    };
  }

  const authorAssociation = event.comment?.author_association;
  if (!ALLOWED_ASSOCIATIONS.has(authorAssociation)) {
    throw new Error("只有 OWNER、MEMBER 或 COLLABORATOR 可以批准 AI 继续执行");
  }

  const issueNumber = String(event.issue.number);
  const issueTitle = normalizeTitle(event.issue.title);
  const commentId = String(event.comment.id);
  const branch = `ai/issue-${issueNumber}-${commentId}`;
  const slug = slugify(issueTitle, `issue-${issueNumber}`);
  const designFile = `docs/design/ISSUE-${issueNumber}-${slug}.md`;
  const tempDir = process.env.RUNNER_TEMP ?? path.join(workspace, ".tmp");
  const prBodyFile = path.join(tempDir, `issue-${issueNumber}-pr-body.md`);
  const designPath = path.join(workspace, designFile);

  await mkdir(path.dirname(designPath), { recursive: true });
  await mkdir(path.dirname(prBodyFile), { recursive: true });

  const sections = parseIssueSections(event.issue.body ?? "");
  await writeFile(
    designPath,
    buildDesignDocument({
      issueNumber,
      issueTitle,
      issueUrl: event.issue.html_url,
      approver: event.comment.user?.login ?? "unknown",
      commentId,
      sections
    }),
    "utf8"
  );
  await writeFile(
    prBodyFile,
    buildPullRequestBody({
      issueNumber,
      issueTitle,
      designFile,
      approver: event.comment.user?.login ?? "unknown",
      commentUrl: event.comment.html_url
    }),
    "utf8"
  );

  return {
    approved: true,
    issueNumber,
    branch,
    designFile,
    prBodyFile,
    commitMessage: `docs: add design for issue #${issueNumber}`,
    prTitle: `[ai] Design for #${issueNumber} ${issueTitle}`
  };
}

export async function readEventFile(eventPath) {
  return JSON.parse(await readFile(eventPath, "utf8"));
}

export async function appendGitHubOutputs(outputs, outputPath = process.env.GITHUB_OUTPUT) {
  if (!outputPath) {
    return;
  }

  const content = Object.entries(outputs)
    .map(([key, value]) => `${key}=${String(value).replaceAll("\n", " ")}`)
    .join("\n");

  await writeFile(outputPath, `${content}\n`, { flag: "a" });
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

function buildDesignDocument({ issueNumber, issueTitle, issueUrl, approver, commentId, sections }) {
  const background = sectionOrFallback(sections, "背景");
  const goal = sectionOrFallback(sections, "目标");
  const nonGoals = sectionOrFallback(sections, "不做什么");
  const acceptance = sectionOrFallback(sections, "验收标准");
  const impact = sectionOrFallback(sections, "影响范围");
  const aiLevel = sectionOrFallback(sections, "AI 可执行等级");

  return [
    `# ISSUE-${issueNumber}: ${issueTitle}`,
    "",
    "## 来源",
    "",
    `- Issue: ${issueUrl ?? `#${issueNumber}`}`,
    `- AI 可执行等级：${aiLevel}`,
    "",
    "## 背景",
    "",
    background,
    "",
    "## 目标",
    "",
    goal,
    "",
    "## 非目标",
    "",
    nonGoals,
    "",
    "## 影响范围",
    "",
    impact,
    "",
    "## 验收标准",
    "",
    acceptance,
    "",
    "## 初始执行方案",
    "",
    "1. 读取 Issue 中的背景、目标、非目标和验收标准。",
    "2. 先补充设计文档，等待人工 review。",
    "3. 设计 PR 合并后，再进入实现分支。",
    "4. 实现阶段必须补充测试，并通过 CI 后再请求 review。",
    "",
    "## 风险与人工 Gate",
    "",
    "- 该 PR 只沉淀设计，不直接修改业务代码。",
    "- 如果需求涉及外部网站、生产数据、密钥、付费 API 或高风险操作，必须再次等待人工确认。",
    "- 任何发布动作都必须通过独立的发布确认 Gate。",
    "",
    "## Human Approval Gateway",
    "",
    `由 @${approver} 在评论 ${commentId} 中批准生成该设计分支。`,
    ""
  ].join("\n");
}

function buildPullRequestBody({ issueNumber, issueTitle, designFile, approver, commentUrl }) {
  return [
    "## 变更说明",
    "",
    `- 根据 Issue #${issueNumber} 的 /ai approve 指令生成设计文档。`,
    `- 设计文档：\`${designFile}\``,
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
    "- [ ] 人工 review 设计文档",
    "- [ ] 确认是否允许进入实现阶段",
    "",
    "## 风险",
    "",
    `- 当前 PR 仅生成 #${issueNumber} ${issueTitle} 的设计草稿，不直接实现代码。`,
    "- 需要人工确认范围、风险和下一步实现策略。"
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
