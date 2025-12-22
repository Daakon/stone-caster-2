---
description: Dependency Update Workflow
---
To keep dependencies up to date and secure, follow this workflow when asked to perform updates:

1.  **Check for Outdated Packages**: In the relevant workspace (`frontend` or `backend`), run `npm outdated` to list packages that have newer versions available.
2.  **Assess Updates**: Review the list, paying close attention to major version changes (e.g., 2.x.x -> 3.x.x) which indicate potentially breaking changes.
3.  **Propose Update Plan**: Present the plan to the user, grouping updates by minor/patch (generally safe) and major (requires more caution). Ask for confirmation before proceeding with the installation.
4.  **Install Updates**: Upon approval, run `npm install <package>@<version>` for the selected packages.
5.  **Verify**: After updates are installed, run the test suite (`npm test`) and type-checking (`npm run typecheck`) to ensure the updates have not introduced any regressions. Fix any resulting issues.