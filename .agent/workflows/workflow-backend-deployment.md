---
description: Backend Deployment Workflow
---
When asked to deploy the backend, you must follow these steps:

1.  **Verify Tests**: Ask if you should run the backend test suite (`npm test` in the `backend` directory) to ensure all tests are passing before deployment. Proceed only on user confirmation or if told to skip.
2.  **Identify Script**: Locate the appropriate deployment script in the root directory (e.g., `deploy-backend.ps1`).
3.  **Execute Deployment**: Run the identified deployment script using the shell tool.
4.  **Monitor**: Monitor the output of the deployment script for any errors. Report the final status (success or failure) to the user.
