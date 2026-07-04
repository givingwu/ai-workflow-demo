const AI_EXECUTION_POLICIES = Object.freeze({
  "human-only": Object.freeze({
    aiExecutionLevel: "human-only",
    canCreateBranch: false,
    canCreatePullRequest: false
  }),
  assist: Object.freeze({
    aiExecutionLevel: "assist",
    canCreateBranch: false,
    canCreatePullRequest: false
  }),
  "auto-branch": Object.freeze({
    aiExecutionLevel: "auto-branch",
    canCreateBranch: true,
    canCreatePullRequest: false
  }),
  "auto-pr": Object.freeze({
    aiExecutionLevel: "auto-pr",
    canCreateBranch: true,
    canCreatePullRequest: true
  })
});

const VALID_LEVELS = Object.keys(AI_EXECUTION_POLICIES).join("、");

export function resolveAiExecutionPolicy(sections) {
  const rawLevel = sections["AI 可执行等级"] ?? "";
  const aiExecutionLevel = normalizeAiExecutionLevel(rawLevel);
  const policy = AI_EXECUTION_POLICIES[aiExecutionLevel];

  if (!policy) {
    return {
      aiExecutionLevel: aiExecutionLevel || "missing",
      canCreateBranch: false,
      canCreatePullRequest: false,
      blockedReason: `AI 可执行等级必须是 ${VALID_LEVELS}，当前为 ${formatLevel(aiExecutionLevel)}。`
    };
  }

  if (!policy.canCreateBranch) {
    return {
      ...policy,
      blockedReason: buildBlockedReason(policy.aiExecutionLevel)
    };
  }

  return {
    ...policy,
    blockedReason: ""
  };
}

function normalizeAiExecutionLevel(value) {
  return String(value)
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^-\s*/, ""))
    .find(Boolean)
    ?.toLowerCase() ?? "";
}

function buildBlockedReason(aiExecutionLevel) {
  if (aiExecutionLevel === "human-only") {
    return "AI 可执行等级为 human-only，该任务只能人工处理，AI 不会创建分支或 PR。";
  }

  return "AI 可执行等级为 assist，仅允许 AI 输出建议，不允许创建分支或 PR。";
}

function formatLevel(aiExecutionLevel) {
  return aiExecutionLevel ? aiExecutionLevel : "未设置";
}
