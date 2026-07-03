import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createDesignMergedNotification } from "../scripts/design-merged-gateway.mjs";
import { createImplementationArtifacts } from "../scripts/implementation-gateway.mjs";

test("设计 PR 合并后生成进入实现阶段的人工确认评论", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "ai-design-merged-"));

  try {
    const tempDir = path.join(workspace, ".tmp");
    const result = await createDesignMergedNotification({
      event: createPullRequestClosedEvent(),
      tempDir
    });

    assert.equal(result.notify, true);
    assert.equal(result.issueNumber, "1");
    assert.equal(result.commentBodyFile, path.join(tempDir, "issue-1-implementation-gate.md"));

    const body = await readFile(result.commentBodyFile, "utf8");
    assert.match(body, /设计 PR 已合并/);
    assert.match(body, /\/ai implement/);
    assert.match(body, /https:\/\/github.com\/givingwu\/ai-workflow-demo\/pull\/2/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("非设计 PR 合并不会生成实现确认评论", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "ai-design-merged-"));

  try {
    const result = await createDesignMergedNotification({
      event: createPullRequestClosedEvent({ title: "docs: update README" }),
      tempDir: path.join(workspace, ".tmp")
    });

    assert.equal(result.notify, false);
    assert.equal(result.reason, "pull request is not an AI design PR");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("owner 回复 /ai implement 时生成实现分支文件和 PR 元数据", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "ai-implementation-"));

  try {
    const tempDir = path.join(workspace, ".tmp");
    await mkdir(path.join(workspace, "docs/design"), { recursive: true });
    await writeFile(
      path.join(workspace, "docs/design/ISSUE-1-feature-demo.md"),
      "# ISSUE-1: Feature demo\n\n## 初始执行方案\n\n1. 先补测试。\n",
      "utf8"
    );

    const result = await createImplementationArtifacts({
      event: createIssueCommentEvent(),
      workspace,
      tempDir
    });

    assert.equal(result.implemented, true);
    assert.equal(result.issueNumber, "1");
    assert.equal(result.branch, "ai/implement-issue-1-98765");
    assert.equal(result.designFile, "docs/design/ISSUE-1-feature-demo.md");
    assert.equal(result.implementationFile, "docs/implementation/ISSUE-1-feature-demo.md");
    assert.equal(result.sourceFile, "src/generated/issue-1-implementation.js");
    assert.equal(result.testFile, "tests/generated/issue-1-implementation.test.js");
    assert.equal(result.commitMessage, "feat: implement issue #1 workflow scaffold");
    assert.equal(result.prTitle, "[ai] Implement #1 Feature demo");

    const implementation = await readFile(path.join(workspace, result.implementationFile), "utf8");
    assert.match(implementation, /设计文档：docs\/design\/ISSUE-1-feature-demo.md/);
    assert.match(implementation, /生成实现文档并创建 PR/);

    const source = await readFile(path.join(workspace, result.sourceFile), "utf8");
    assert.match(source, /Feature demo/);
    assert.match(source, /acceptanceCriteria/);

    const generatedTest = await readFile(path.join(workspace, result.testFile), "utf8");
    assert.match(generatedTest, /getImplementationSummary/);

    const prBody = await readFile(result.prBodyFile, "utf8");
    assert.match(prBody, /Refs #1/);
    assert.match(prBody, /src\/generated\/issue-1-implementation.js/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("非 implement 评论不会生成实现产物", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "ai-implementation-"));

  try {
    const result = await createImplementationArtifacts({
      event: createIssueCommentEvent({ commentBody: "/ai revise 先调整设计" }),
      workspace
    });

    assert.equal(result.implemented, false);
    assert.equal(result.reason, "comment is not an implementation command");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("缺少已合并设计文档时拒绝进入实现阶段", async () => {
  const workspace = await mkdtemp(path.join(tmpdir(), "ai-implementation-"));

  try {
    await assert.rejects(
      () =>
        createImplementationArtifacts({
          event: createIssueCommentEvent(),
          workspace
        }),
      /缺少已合并设计文档/
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

function createPullRequestClosedEvent(options = {}) {
  return {
    action: "closed",
    pull_request: {
      merged: options.merged ?? true,
      title: options.title ?? "[ai] Design for #1 Feature demo",
      body: options.body ?? "Refs #1",
      html_url: "https://github.com/givingwu/ai-workflow-demo/pull/2",
      number: 2
    }
  };
}

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
        "生成实现文档并创建 PR。",
        "",
        "### 不做什么",
        "",
        "不直接发布。",
        "",
        "### 验收标准",
        "",
        "- [ ] 生成实现文档",
        "- [ ] 生成实现代码",
        "- [ ] 生成测试",
        "",
        "### 影响范围",
        "",
        "docs/implementation, src/generated, tests/generated",
        "",
        "### AI 可执行等级",
        "",
        "auto-pr"
      ].join("\n"),
      pull_request: options.pullRequest
    },
    comment: {
      id: 98765,
      body: options.commentBody ?? "/ai implement",
      author_association: options.authorAssociation ?? "OWNER",
      html_url: "https://github.com/givingwu/ai-workflow-demo/issues/1#issuecomment-98765",
      user: {
        login: "givingwu"
      }
    }
  };
}
