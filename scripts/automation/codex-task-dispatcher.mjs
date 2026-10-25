import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const DEFAULT_POLICY = Object.freeze({
  repository: "tranhuunguyenhuy-hue/dongphugia.com.vn",
  issueNumber: 160,
  workflowRef:
    "tranhuunguyenhuy-hue/dongphugia.com.vn/.github/workflows/codex-task-dispatcher.yml@refs/heads/main",
  approvalLabel: "codex:dispatch-approved",
});

function rejected(reason, taskId) {
  return {
    accepted: false,
    reason,
    ...(taskId ? { taskId } : {}),
  };
}

export function evaluateTaskEvent({
  eventName,
  event,
  context,
  policy = DEFAULT_POLICY,
}) {
  if (eventName !== "issues" || event?.action !== "labeled") {
    return rejected("unsupported_event");
  }

  if (context?.workflowRef !== policy.workflowRef) {
    return rejected("untrusted_workflow_ref");
  }

  if (
    event?.repository?.full_name !== policy.repository ||
    event?.issue?.number !== policy.issueNumber ||
    event?.issue?.state !== "open" ||
    event?.issue?.pull_request ||
    event?.label?.name !== policy.approvalLabel ||
    event?.sender?.login == null ||
    event?.repository?.id == null ||
    event?.issue?.id == null ||
    event?.label?.id == null ||
    event?.issue?.updated_at == null
  ) {
    return rejected("event_outside_policy");
  }

  if (context.actorPermission !== "admin") {
    return rejected("actor_not_owner");
  }

  const taskId = `dpg-${createHash("sha256")
    .update(
      [
        event.repository.id,
        event.issue.id,
        event.label.id,
        event.issue.updated_at,
      ].join(":"),
    )
    .digest("hex")}`;

  if (context.processedTaskIds?.includes(taskId)) {
    return rejected("duplicate_task", taskId);
  }

  return {
    accepted: true,
    taskId,
    repository: policy.repository,
    issueNumber: policy.issueNumber,
    workflowRef: policy.workflowRef,
  };
}

export async function fetchActorPermission({
  repository,
  actor,
  token,
  fetchImpl = fetch,
}) {
  if (!repository || !actor || !token) return null;

  const response = await fetchImpl(
    `https://api.github.com/repos/${repository}/collaborators/${encodeURIComponent(actor)}/permission`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2026-03-10",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) return null;
  const body = await response.json();
  return typeof body.permission === "string" ? body.permission : null;
}

async function runCli() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;

  if (!eventPath || !token || !repository) {
    throw new Error("Required GitHub Actions context is missing.");
  }

  const event = JSON.parse(await readFile(eventPath, "utf8"));
  const actorPermission = await fetchActorPermission({
    repository,
    actor: event?.sender?.login,
    token,
  });
  const result = evaluateTaskEvent({
    eventName: process.env.GITHUB_EVENT_NAME,
    event,
    context: {
      workflowRef: process.env.GITHUB_WORKFLOW_REF,
      actorPermission,
      runId: process.env.GITHUB_RUN_ID,
      processedTaskIds: [],
    },
  });

  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.accepted) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  runCli().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
