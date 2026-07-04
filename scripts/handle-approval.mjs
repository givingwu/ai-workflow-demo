import {
  appendGitHubOutputs,
  createApprovalArtifacts,
  readEventFile
} from "./approval-gateway.mjs";

const eventPath = process.argv[2] ?? process.env.GITHUB_EVENT_PATH;

if (!eventPath) {
  throw new Error("缺少 GitHub event path");
}

const result = await createApprovalArtifacts({
  event: await readEventFile(eventPath),
  workspace: process.cwd()
});

await appendGitHubOutputs({
  approved: result.approved,
  reason: result.reason ?? "",
  issue_number: result.issueNumber ?? "",
  ai_execution_level: result.aiExecutionLevel ?? "",
  create_pr: result.createPullRequest ?? "",
  branch: result.branch ?? "",
  design_file: result.designFile ?? "",
  pr_body_file: result.prBodyFile ?? "",
  commit_message: result.commitMessage ?? "",
  pr_title: result.prTitle ?? ""
});

if (result.approved) {
  console.log(`Approval accepted for issue #${result.issueNumber}`);
  console.log(`Generated ${result.designFile}`);
} else {
  console.log(`Approval skipped: ${result.reason}`);
}
