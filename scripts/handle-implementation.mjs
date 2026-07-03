import { appendGitHubOutputs, readEventFile } from "./approval-gateway.mjs";
import { createImplementationArtifacts } from "./implementation-gateway.mjs";

const eventPath = process.argv[2] ?? process.env.GITHUB_EVENT_PATH;

if (!eventPath) {
  throw new Error("缺少 GitHub event path");
}

const result = await createImplementationArtifacts({
  event: await readEventFile(eventPath),
  workspace: process.cwd()
});

await appendGitHubOutputs({
  implemented: result.implemented,
  reason: result.reason ?? "",
  issue_number: result.issueNumber ?? "",
  branch: result.branch ?? "",
  design_file: result.designFile ?? "",
  implementation_file: result.implementationFile ?? "",
  source_file: result.sourceFile ?? "",
  test_file: result.testFile ?? "",
  pr_body_file: result.prBodyFile ?? "",
  commit_message: result.commitMessage ?? "",
  pr_title: result.prTitle ?? ""
});

if (result.implemented) {
  console.log(`Implementation accepted for issue #${result.issueNumber}`);
  console.log(`Generated ${result.implementationFile}`);
  console.log(`Generated ${result.sourceFile}`);
  console.log(`Generated ${result.testFile}`);
} else {
  console.log(`Implementation skipped: ${result.reason}`);
}
