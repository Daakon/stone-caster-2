import { z } from "zod";

const BranchSchema = z.object({
  protected: z.boolean(),
  commit: z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) }),
});
const EnvironmentSchema = z.object({
  name: z.string(),
  can_admins_bypass: z.boolean(),
  deployment_branch_policy: z
    .object({
      protected_branches: z.boolean(),
      custom_branch_policies: z.boolean(),
    })
    .nullable(),
  protection_rules: z.array(
    z.object({
      type: z.string(),
      prevent_self_review: z.boolean().optional(),
      reviewers: z.array(z.object({})).optional(),
    }),
  ),
});
export type ContentDeploymentGate = {
  branch: z.infer<typeof BranchSchema>;
  environment: z.infer<typeof EnvironmentSchema>;
};

export class ContentDeploymentGateRepository {
  constructor(private readonly request: typeof fetch = fetch) {}

  async inspect(
    repository: string,
    target: "staging" | "production",
    token: string,
  ): Promise<ContentDeploymentGate> {
    if (
      !/^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(
        repository,
      )
    )
      throw new Error("Invalid GitHub repository identity.");
    const read = async (path: string): Promise<unknown> => {
      const response = await this.request(
        `https://api.github.com/repos/${repository}/${path}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          redirect: "error",
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!response.ok)
        throw new Error("GitHub deployment protection could not be verified.");
      return response.json();
    };
    const [branch, environment] = await Promise.all([
      read("branches/main"),
      read(`environments/content-${target}`),
    ]);
    return {
      branch: BranchSchema.parse(branch),
      environment: EnvironmentSchema.parse(environment),
    };
  }
}
