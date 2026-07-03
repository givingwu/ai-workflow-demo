import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createApprovalArtifacts } from "../scripts/approval-gateway.mjs";

test("owner 回复 /ai approve 时生成设计文档和 PR 元数据", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "ai-approval-"));

  try {
    const result = await createApprovalArtifacts({
      event: createIssueCommentEvent(),
      workspace
    });

    assert.equal(result.approved, true);
    assert.equal(result.issueNumber, "1");
    assert.equal(result.branch, "ai/issue-1-98765");
    assert.equal(result.designFile, "docs/design/ISSUE-1-feature-demo.md");
    assert.equal(result.commitMessage, "docs: add design for issue #1");
    assert.equal(result.prTitle, "[ai] Design for #1 Feature demo");
    assert.equal(result.prBodyFile, path.join(workspace, ".tmp", "issue-1-pr-body.md"));

    const design = await readFile(path.join(workspace, result.designFile), "utf8");
    assert.match(design, /# ISSUE-1: Feature demo/);
    assert.match(design, /## 背景/);
    assert.match(design, /需要一个可执行的示例/);
    assert.match(design, /## Human Approval Gateway/);
    assert.match(design, /由 @givingwu 在评论 98765 中批准/);

    const prBody = await readFile(result.prBodyFile, "utf8");
    assert.match(prBody, /Refs #1/);
    assert.match(prBody, /docs\/design\/ISSUE-1-feature-demo.md/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("非 approve 评论不会生成产物", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "ai-approval-"));

  try {
    const event = createIssueCommentEvent({ commentBody: "/ai revise 需要调整范围" });
    const result = await createApprovalArtifacts({ event, workspace });

    assert.equal(result.approved, false);
    assert.equal(result.reason, "comment is not an approval command");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("非协作者不能触发 approve", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "ai-approval-"));

  try {
    const event = createIssueCommentEvent({ authorAssociation: "CONTRIBUTOR" });

    await assert.rejects(
      () => createApprovalArtifacts({ event, workspace }),
      /只有 OWNER、MEMBER 或 COLLABORATOR 可以批准/
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

function createIssueCommentEvent(options = {}) {
  return {
    action: "created",
    issue: {
      number: 1,
      title: "Feature demo",
      body: [
        "### 背景",
        "",
        "需要一个可执行的示例。",
        "",
        "### 目标",
        "",
        "生成设计文档并创建 PR。",
        "",
        "### 不做什么",
        "",
        "不直接合并代码。",
        "",
        "### 验收标准",
        "",
        "- [ ] 生成设计文档",
        "- [ ] 创建 PR",
        "",
        "### 影响范围",
        "",
        "docs/design",
        "",
        "### AI 可执行等级",
        "",
        "auto-pr"
      ].join("\n"),
      pull_request: options.pullRequest
    },
    comment: {
      id: 98765,
      body: options.commentBody ?? "/ai approve",
      author_association: options.authorAssociation ?? "OWNER",
      user: {
        login: "givingwu"
      }
    }
  };
}
