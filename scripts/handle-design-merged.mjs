import { appendGitHubOutputs } from "./approval-gateway.mjs";
import {
  createDesignMergedNotification,
  readEventFile
} from "./design-merged-gateway.mjs";

const eventPath = process.argv[2] ?? process.env.GITHUB_EVENT_PATH;

if (!eventPath) {
  throw new Error("缺少 GitHub event path");
}

const result = await createDesignMergedNotification({
  event: await readEventFile(eventPath)
});

await appendGitHubOutputs({
  notify: result.notify,
  reason: result.reason ?? "",
  issue_number: result.issueNumber ?? "",
  comment_body_file: result.commentBodyFile ?? ""
});

if (result.notify) {
  console.log(`Implementation gate comment prepared for issue #${result.issueNumber}`);
} else {
  console.log(`Implementation gate skipped: ${result.reason}`);
}
