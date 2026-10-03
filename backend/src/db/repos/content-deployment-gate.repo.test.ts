import { describe, expect, it, vi } from "vitest";
import { ContentDeploymentGateRepository } from "./content-deployment-gate.repo.js";
describe("read-only GitHub content deployment inspection", () => {
  it("uses fixed API endpoints with timeouts and rejects redirects", async () => {
    const branch = { protected: true, commit: { sha: "a".repeat(40) } };
    const environment = {
      name: "content-production",
      can_admins_bypass: false,
      deployment_branch_policy: {
        protected_branches: true,
        custom_branch_policies: false,
      },
      protection_rules: [],
    };
    const request = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValueOnce(Response.json(branch))
      .mockResolvedValueOnce(Response.json(environment));
    expect(
      await new ContentDeploymentGateRepository(request).inspect(
        "Daakon/stone-caster-2",
        "production",
        "token",
      ),
    ).toEqual({ branch, environment });
    const signal: unknown = expect.any(AbortSignal);
    const headers: unknown = expect.objectContaining({
      Authorization: "Bearer token",
    });
    expect(request).toHaveBeenCalledWith(
      "https://api.github.com/repos/Daakon/stone-caster-2/environments/content-production",
      expect.objectContaining({
        redirect: "error",
        signal,
        headers,
      }),
    );
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("rejects repository URL injection without making requests", async () => {
    const request = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>();
    await expect(
      new ContentDeploymentGateRepository(request).inspect(
        "../other?",
        "staging",
        "token",
      ),
    ).rejects.toThrow("Invalid GitHub");
    expect(request).not.toHaveBeenCalled();
  });
  it("rejects missing environments and malformed API responses", async () => {
    const missing = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockResolvedValue(new Response("private-body", { status: 404 }));
    await expect(
      new ContentDeploymentGateRepository(missing).inspect(
        "owner/repo",
        "staging",
        "token",
      ),
    ).rejects.toThrow("could not be verified");
    const malformed = vi
      .fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>()
      .mockImplementation(() => Promise.resolve(Response.json({})));
    await expect(
      new ContentDeploymentGateRepository(malformed).inspect(
        "owner/repo",
        "staging",
        "token",
      ),
    ).rejects.toThrow();
  });
});
