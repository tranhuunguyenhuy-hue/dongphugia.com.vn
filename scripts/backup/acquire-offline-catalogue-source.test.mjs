import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repository = "tranhuunguyenhuy-hue/dongphugia.com.vn";
const script = "scripts/backup/acquire-offline-catalogue-ciphertext.sh";
const sourceFiles = [
  script,
  "scripts/backup/offline-catalogue-transfer-contract.mjs",
  "scripts/backup/catalogue-restore-contract.mjs",
];

function command(binary, args, options = {}) {
  const result = spawnSync(binary, args, { encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`${binary} ${args.join(" ")} failed: ${result.stderr}`);
  }
  return result.stdout.trim();
}

async function reviewedCheckout() {
  const parent = await mkdtemp(join(tmpdir(), "dpg-reviewed-source-test-"));
  const repo = join(parent, "repo");
  const bin = join(parent, "bin");
  await mkdir(join(repo, "scripts/backup"), { recursive: true });
  await mkdir(bin);
  for (const path of sourceFiles) await copyFile(path, join(repo, path));
  command("git", ["init", "-q", "-b", "main", repo]);
  command("git", [
    "-C",
    repo,
    "remote",
    "add",
    "origin",
    `https://github.com/${repository}.git`,
  ]);
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: "Source Test",
    GIT_AUTHOR_EMAIL: "source-test@example.invalid",
    GIT_COMMITTER_NAME: "Source Test",
    GIT_COMMITTER_EMAIL: "source-test@example.invalid",
  };
  command("git", ["-C", repo, "add", "scripts"], { env: gitEnv });
  command("git", ["-C", repo, "commit", "-qm", "main source"], { env: gitEnv });
  const mainSha = command("git", ["-C", repo, "rev-parse", "HEAD"]);
  command("git", ["-C", repo, "checkout", "-qb", "reviewed-source"]);
  await writeFile(join(repo, "reviewed.txt"), "reviewed PR commit\n");
  command("git", ["-C", repo, "add", "reviewed.txt"], { env: gitEnv });
  command("git", ["-C", repo, "commit", "-qm", "reviewed source"], {
    env: gitEnv,
  });
  const prSha = command("git", ["-C", repo, "rev-parse", "HEAD"]);
  command("git", ["-C", repo, "checkout", "-q", "--detach", prSha]);
  const scriptSha = createHash("sha256")
    .update(await readFile(join(repo, script)))
    .digest("hex");
  const gh = join(bin, "gh");
  await writeFile(
    gh,
    `#!/bin/sh\n` +
      `printf '%s\\n' "$2" >> "$TEST_GH_LOG"\n` +
      `case "$2" in\n` +
      `  "repos/${repository}/commits/main") printf '%s\\n' "$TEST_MAIN_SHA" ;;\n` +
      `  "repos/${repository}/pulls/161") printf '%s\\n' "$TEST_PR_JSON" ;;\n` +
      `  *) exit 90 ;;\n` +
      `esac\n`,
    { mode: 0o700 },
  );
  const pr = {
    number: 161,
    state: "open",
    draft: false,
    merged_at: null,
    head: {
      sha: prSha,
      ref: "codex/offline-catalogue-rehearsal",
      repo: { id: 1157762683, full_name: repository },
    },
    base: {
      sha: mainSha,
      ref: "main",
      repo: { id: 1157762683, full_name: repository },
    },
  };
  const log = join(parent, "gh-requests.txt");
  const invoke = (overrides = {}) =>
    spawnSync("bash", [join(repo, script), join(parent, "private-output")], {
      cwd: repo,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        ACQUISITION_SOURCE_MODE: "reviewed-pr",
        EXPECTED_MAIN_SHA: mainSha,
        EXPECTED_PR_HEAD_SHA: prSha,
        EXPECTED_SCRIPT_SHA256: scriptSha,
        GH_TOKEN: "nonsecret-test-credential",
        TEST_GH_LOG: log,
        TEST_MAIN_SHA: mainSha,
        TEST_PR_JSON: JSON.stringify(pr),
        ...overrides,
      },
    });
  return { parent, repo, log, invoke, pr };
}

describe("reviewed PR acquisition source gate", () => {
  it("keeps the canonical main source path available without querying PR metadata", async () => {
    const fixture = await reviewedCheckout();
    try {
      command("git", ["-C", fixture.repo, "checkout", "-q", "main"]);
      const result = fixture.invoke({ ACQUISITION_SOURCE_MODE: "main" });
      expect(result.stderr).toContain("github_run_metadata_unavailable");
      const requests = await readFile(fixture.log, "utf8");
      expect(requests).not.toContain("/pulls/161");
      expect(requests).not.toContain("/zip");
    } finally {
      await rm(fixture.parent, { recursive: true, force: true });
    }
  });

  it("accepts a clean, pinned canonical PR commit and stops before artifact download if run metadata is unavailable", async () => {
    const fixture = await reviewedCheckout();
    try {
      const result = fixture.invoke();
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("github_run_metadata_unavailable");
      const requests = await readFile(fixture.log, "utf8");
      expect(requests).toContain(`/pulls/161\n`);
      expect(requests).toContain(`/actions/runs/38915575745\n`);
      expect(requests).not.toContain("/zip");
    } finally {
      await rm(fixture.parent, { recursive: true, force: true });
    }
  });

  it("refuses a script hash that was not approved before any GitHub request", async () => {
    const fixture = await reviewedCheckout();
    try {
      const result = fixture.invoke({ EXPECTED_SCRIPT_SHA256: "0".repeat(64) });
      expect(result.stderr).toContain("reviewed_script_hash_mismatch");
      await expect(readFile(fixture.log, "utf8")).rejects.toThrow();
    } finally {
      await rm(fixture.parent, { recursive: true, force: true });
    }
  });

  it("refuses a moved PR head before requesting backup metadata", async () => {
    const fixture = await reviewedCheckout();
    try {
      const movedPr = {
        ...fixture.pr,
        head: { ...fixture.pr.head, sha: "9".repeat(40) },
      };
      const result = fixture.invoke({ TEST_PR_JSON: JSON.stringify(movedPr) });
      expect(result.stderr).toContain("acquisition_pr_identity_mismatch");
      const requests = await readFile(fixture.log, "utf8");
      expect(requests).toContain(`/pulls/161\n`);
      expect(requests).not.toContain("/actions/runs/");
      expect(requests).not.toContain("/zip");
    } finally {
      await rm(fixture.parent, { recursive: true, force: true });
    }
  });
});
