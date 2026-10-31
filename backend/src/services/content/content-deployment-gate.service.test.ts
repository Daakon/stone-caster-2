import { describe, expect, it, vi } from "vitest";
import { ContentDeploymentGateService } from "./content-deployment-gate.service.js";
import type { ContentDeploymentGate } from "../../db/repos/content-deployment-gate.repo.js";
const env = {
  GITHUB_ACTIONS: "true",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REF: "refs/heads/main",
  GITHUB_TOKEN: "private-token",
  GITHUB_SHA: "a".repeat(40),
  GITHUB_REPOSITORY: "Daakon/stone-caster-2",
  GITHUB_WORKFLOW_REF:
    "Daakon/stone-caster-2/.github/workflows/deploy-content.yml@refs/heads/main",
};
const gate: ContentDeploymentGate = {
  branch: { protected: true, commit: { sha: env.GITHUB_SHA } },
  environment: {
    name: "content-staging",
    can_admins_bypass: false,
    deployment_branch_policy: {
      protected_branches: true,
      custom_branch_policies: false,
    },
    protection_rules: [
      {
        type: "required_reviewers",
        prevent_self_review: true,
        reviewers: [{}],
      },
    ],
  },
};
describe("protected manual content deployment", () => {
  it("checks current main and explicit protected environment using a read-only token", async () => {
    const repo = { inspect: vi.fn().mockResolvedValue(gate) };
    await new ContentDeploymentGateService(repo).check(
      ["--target=staging"],
      env,
    );
    expect(repo.inspect).toHaveBeenCalledWith(
      env.GITHUB_REPOSITORY,
      "staging",
      env.GITHUB_TOKEN,
    );
  });
  it.each(
    [[], ["--target=local"], ["staging"], ["--target=staging", "--force"]].map(
      (args) => ({ args }),
    ),
  )("rejects invalid target arguments %j", async ({ args }) => {
    const repo = { inspect: vi.fn() };
    await expect(
      new ContentDeploymentGateService(repo).check(args, env),
    ).rejects.toMatchObject({ exitCode: 2 });
    expect(repo.inspect).not.toHaveBeenCalled();
  });
  it.each([
    "GITHUB_ACTIONS",
    "GITHUB_EVENT_NAME",
    "GITHUB_REF",
    "GITHUB_TOKEN",
    "GITHUB_SHA",
    "GITHUB_REPOSITORY",
    "GITHUB_WORKFLOW_REF",
  ])("rejects missing workflow context %s", async (key) => {
    const repo = { inspect: vi.fn() };
    await expect(
      new ContentDeploymentGateService(repo).check(["--target=staging"], {
        ...env,
        [key]: undefined,
      }),
    ).rejects.toMatchObject({ exitCode: 2 });
    expect(repo.inspect).not.toHaveBeenCalled();
  });
  it.each([
    { ...gate, branch: { ...gate.branch, protected: false } },
    { ...gate, branch: { ...gate.branch, commit: { sha: "b".repeat(40) } } },
    {
      ...gate,
      environment: { ...gate.environment, name: "content-production" },
    },
    { ...gate, environment: { ...gate.environment, can_admins_bypass: true } },
    {
      ...gate,
      environment: { ...gate.environment, deployment_branch_policy: null },
    },
    {
      ...gate,
      environment: {
        ...gate.environment,
        deployment_branch_policy: {
          protected_branches: false,
          custom_branch_policies: true,
        },
      },
    },
    { ...gate, environment: { ...gate.environment, protection_rules: [] } },
    {
      ...gate,
      environment: {
        ...gate.environment,
        protection_rules: [
          {
            type: "required_reviewers",
            prevent_self_review: true,
            reviewers: [],
          },
        ],
      },
    },
    {
      ...gate,
      environment: {
        ...gate.environment,
        protection_rules: [
          {
            type: "required_reviewers",
            prevent_self_review: false,
            reviewers: [{}],
          },
        ],
      },
    },
  ])(
    "denies stale main or incomplete environment protection",
    async (state) => {
      await expect(
        new ContentDeploymentGateService({
          inspect: vi.fn().mockResolvedValue(state),
        }).check(["--target=staging"], env),
      ).rejects.toThrow("existing environment");
    },
  );
  it("fails closed on API failures without exposing token or response details", async () => {
    await expect(
      new ContentDeploymentGateService({
        inspect: vi.fn().mockRejectedValue(new Error("private-token response")),
      }).check(["--target=staging"], env),
    ).rejects.toThrow("could not be verified");
  });
});
