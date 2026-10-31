import { ContentDeploymentGateRepository } from "../../db/repos/content-deployment-gate.repo.js";
import { ContentSyncError } from "./content-sync.service.js";

export class ContentDeploymentGateService {
  constructor(
    private readonly repository: Pick<
      ContentDeploymentGateRepository,
      "inspect"
    > = new ContentDeploymentGateRepository(),
  ) {}
  async check(args: string[], env: NodeJS.ProcessEnv): Promise<void> {
    const target = args[0]?.slice("--target=".length);
    if (
      args.length !== 1 ||
      !args[0]?.startsWith("--target=") ||
      (target !== "staging" && target !== "production")
    )
      throw new ContentSyncError(
        "Deployment protection check requires --target=staging|production.",
        2,
      );
    if (
      env.GITHUB_ACTIONS !== "true" ||
      env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      env.GITHUB_REF !== "refs/heads/main" ||
      !env.GITHUB_TOKEN ||
      !env.GITHUB_REPOSITORY ||
      !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "") ||
      env.GITHUB_WORKFLOW_REF !==
        `${env.GITHUB_REPOSITORY}/.github/workflows/deploy-content.yml@refs/heads/main`
    )
      throw new ContentSyncError(
        "Content deployment must be manually dispatched from the protected workflow on main.",
        2,
      );
    let gate;
    try {
      gate = await this.repository.inspect(
        env.GITHUB_REPOSITORY,
        target,
        env.GITHUB_TOKEN,
      );
    } catch {
      throw new ContentSyncError(
        "GitHub deployment protection could not be verified; check the configured environment and read permissions.",
        2,
      );
    }
    const environment = gate.environment;
    const review = environment.protection_rules.find(
      (rule) => rule.type === "required_reviewers",
    );
    if (
      !gate.branch.protected ||
      gate.branch.commit.sha !== env.GITHUB_SHA ||
      environment.name !== `content-${target}` ||
      environment.can_admins_bypass ||
      environment.deployment_branch_policy?.protected_branches !== true ||
      environment.deployment_branch_policy.custom_branch_policies ||
      !review?.reviewers?.length ||
      review.prevent_self_review !== true
    )
      throw new ContentSyncError(
        "Deployment requires current protected main and an existing environment with independent required review, protected branches, and administrator bypass disabled.",
        2,
      );
  }
}
