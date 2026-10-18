import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  evaluateTaskEvent,
  fetchActorPermission,
} from "./codex-task-dispatcher.mjs";

const expectedRepository = "tranhuunguyenhuy-hue/dongphugia.com.vn";
const expectedWorkflowRef = `${expectedRepository}/.github/workflows/codex-task-dispatcher.yml@refs/heads/main`;

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    action: "labeled",
    repository: {
      id: 1234,
      full_name: expectedRepository,
    },
    issue: {
      id: 5678,
      number: 160,
      state: "open",
      updated_at: "2026-10-18T13:46:44Z",
      title: "coordination task",
    },
    label: { id: 77, name: "codex:dispatch-approved" },
    sender: { login: "tranhuunguyenhuy-hue" },
    ...overrides,
  };
}

function context(overrides: Record<string, unknown> = {}) {
  return {
    expectedRepository,
    expectedIssueNumber: 160,
    expectedWorkflowRef,
    workflowRef: expectedWorkflowRef,
    actorPermission: "admin",
    runId: "401",
    processedTaskIds: [],
    ...overrides,
  };
}

describe("Codex task dispatcher event boundary", () => {
  it("accepts only the exact owner-authorized approval label on Issue 160 from main", () => {
    const result = evaluateTaskEvent({
      eventName: "issues",
      event: makeEvent(),
      context: context(),
    });

    expect(result).toMatchObject({ accepted: true });
    expect(result.taskId).toMatch(/^dpg-[a-f0-9]{64}$/);
  });

  it("rejects issue comments and pull request events even if their text looks like a command", () => {
    for (const eventName of [
      "issue_comment",
      "pull_request_target",
      "pull_request",
    ]) {
      expect(
        evaluateTaskEvent({
          eventName,
          event: makeEvent({
            comment: { body: "/codex dispatch now" },
            issue: {
              ...makeEvent().issue,
              pull_request: { url: "https://api.github.com/pulls/9" },
            },
          }),
          context: context(),
        }),
      ).toMatchObject({ accepted: false, reason: "unsupported_event" });
    }
  });

  it("rejects any actor whose repository permission API result is not admin", () => {
    for (const actorPermission of ["write", "maintain", "read", "none", null]) {
      expect(
        evaluateTaskEvent({
          eventName: "issues",
          event: makeEvent(),
          context: context({ actorPermission }),
        }),
      ).toMatchObject({ accepted: false, reason: "actor_not_owner" });
    }
  });

  it("rejects a different repository, issue, label, closed issue, or workflow ref", () => {
    const cases = [
      [
        makeEvent({ repository: { id: 2, full_name: "attacker/fork" } }),
        context(),
      ],
      [makeEvent({ issue: { ...makeEvent().issue, number: 161 } }), context()],
      [makeEvent({ label: { id: 77, name: "bug" } }), context()],
      [
        makeEvent({ issue: { ...makeEvent().issue, state: "closed" } }),
        context(),
      ],
      [
        makeEvent(),
        context({
          workflowRef: "attacker/repo/.github/workflows/x.yml@refs/heads/main",
        }),
      ],
    ] as const;

    for (const [event, eventContext] of cases) {
      expect(
        evaluateTaskEvent({
          eventName: "issues",
          event,
          context: eventContext,
        }),
      ).toMatchObject({ accepted: false });
    }
  });

  it("produces a stable idempotency key and rejects a previously processed task", () => {
    const input = {
      eventName: "issues",
      event: makeEvent(),
      context: context(),
    };
    const first = evaluateTaskEvent(input);
    const redelivery = evaluateTaskEvent(input);
    const duplicate = evaluateTaskEvent({
      ...input,
      context: context({ processedTaskIds: [first.taskId] }),
    });

    expect(redelivery.taskId).toBe(first.taskId);
    expect(duplicate).toMatchObject({
      accepted: false,
      reason: "duplicate_task",
      taskId: first.taskId,
    });
  });

  it("does not include issue text or comment content in the dispatch record", () => {
    const event = makeEvent({
      issue: { ...makeEvent().issue, body: "untrusted issue text" },
      comment: { body: "untrusted comment text" },
    });
    const result = evaluateTaskEvent({
      eventName: "issues",
      event,
      context: context(),
    });

    expect(JSON.stringify(result)).not.toContain("untrusted");
    expect(result).not.toHaveProperty("prompt");
  });

  it("resolves the triggering actor permission through GitHub REST, not a username allowlist", async () => {
    let requestUrl = "";
    let requestHeaders: HeadersInit | undefined;
    const permission = await fetchActorPermission({
      repository: expectedRepository,
      actor: "owner name",
      token: "test-token",
      fetchImpl: async (input, init) => {
        requestUrl = String(input);
        requestHeaders = init?.headers;
        return new Response(JSON.stringify({ permission: "admin" }), {
          status: 200,
        });
      },
    });

    expect(permission).toBe("admin");
    expect(requestUrl).toContain("/collaborators/owner%20name/permission");
    expect(requestHeaders).toMatchObject({
      Accept: "application/vnd.github+json",
      Authorization: "Bearer test-token",
    });
  });

  it("runs the CLI entrypoint and fails closed when authenticated Actions context is missing", () => {
    const result = spawnSync(
      process.execPath,
      ["scripts/automation/codex-task-dispatcher.mjs"],
      { env: { PATH: process.env.PATH ?? "" }, encoding: "utf8" },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Required GitHub Actions context is missing.",
    );
    expect(result.stderr).not.toContain("token");
  });

  it("keeps the Actions entrypoint dry-run-only and away from untrusted pull request events", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/codex-task-dispatcher.yml"),
      "utf8",
    );

    expect(workflow).toContain("issues:");
    expect(workflow).toContain("types: [labeled]");
    expect(workflow).toContain("codex:dispatch-approved");
    expect(workflow).not.toContain("workflow_dispatch:");
    expect(workflow).toContain("GITHUB_TOKEN");
    expect(workflow).not.toContain("OPENAI_API_KEY");
    expect(workflow).not.toContain("openai/codex-action");
    expect(workflow).not.toMatch(
      /^\s*(pull_request|pull_request_target|issue_comment):/m,
    );
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("issues: read");
    expect(workflow).not.toContain("contents: write");
    expect(workflow).not.toContain("pull-requests: write");
  });
});
