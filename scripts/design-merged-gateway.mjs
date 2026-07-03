import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DESIGN_PR_TITLE = /^\[ai\]\s+Design\s+for\s+#(?<issueNumber>\d+)\b/i;
const ISSUE_REF = /\b(?:Refs|Closes|Fixes)\s+#(?<issueNumber>\d+)\b/i;

export async function createDesignMergedNotification({
  event,
  tempDir = process.env.RUNNER_TEMP ?? path.join(process.cwd(), ".tmp")
}) {
  const pullRequest = event.pull_request;
  if (!pullRequest?.merged) {
    return {
      notify: false,
      reason: "pull request is not merged"
    };
  }

  const titleMatch = String(pullRequest.title ?? "").match(DESIGN_PR_TITLE);
  if (!titleMatch) {
    return {
      notify: false,
      reason: "pull request is not an AI design PR"
    };
  }

  const issueNumber =
    titleMatch.groups?.issueNumber ??
    String(pullRequest.body ?? "").match(ISSUE_REF)?.groups?.issueNumber;
  if (!issueNumber) {
    return {
      notify: false,
      reason: "design PR does not reference an issue"
    };
  }

  const commentBodyFile = path.join(tempDir, `issue-${issueNumber}-implementation-gate.md`);
  await mkdir(path.dirname(commentBodyFile), { recursive: true });
  await writeFile(
    commentBodyFile,
    buildCommentBody({
      issueNumber,
      pullRequestUrl: pullRequest.html_url,
      pullRequestNumber: pullRequest.number
    }),
    "utf8"
  );

  return {
    notify: true,
    issueNumber,
    commentBodyFile
  };
}

export async function readEventFile(eventPath) {
  return JSON.parse(await readFile(eventPath, "utf8"));
}

function buildCommentBody({ issueNumber, pullRequestUrl, pullRequestNumber }) {
  return [
    "## Design Gate Passed",
    "",
    `设计 PR 已合并：${pullRequestUrl ?? `#${pullRequestNumber}`}`,
    "",
    "如果确认可以进入实现阶段，请回复：",
    "",
    "```text",
    "/ai implement",
    "```",
    "",
    "该指令会创建实现分支、生成实现文件和测试，并打开 Implementation PR。",
    "",
    `Issue: #${issueNumber}`,
    ""
  ].join("\n");
}
