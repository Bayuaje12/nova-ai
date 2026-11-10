# NOVA AI — Autonomous Website Agent

NOVA is a Next.js starter for an AI website agent with three modes:
- Create a new website and publish generated files to a new GitHub repository.
- Update an existing GitHub repository.
- Inspect an existing repository's file tree.

It uses a user's own Gemini API key and GitHub token. There is no NOVA account/login.

## Requirements
- Node.js 20+
- Gemini API key with Generative Language API access
- GitHub personal access token

## Run locally
```bash
npm install
cp .env.example .env.local
npm run dev
```
Open http://localhost:3000.

No user API keys belong in `.env.local`; enter them in the Connections panel. For repository creation, the GitHub token needs permission to create repositories and write repository contents. Fine-grained tokens may need to be configured for the target repository; classic PAT scopes commonly include `repo`.

## Security notes
- Requests use HTTPS when deployed.
- The browser sends credentials to this app's backend API routes; they are not placed in prompts or stored in a database by this starter.
- Optional device remember currently encrypts credentials in browser localStorage using a passphrase-derived AES-GCM key. This is better than plaintext storage, but browser storage is not equivalent to native Android Keystore and is exposed if the browser origin is compromised. Do not use on shared devices.
- For production, add a hardened session vault, CSRF protection, rate limiting, request-size limits, audit logs with secrets redacted, and a dedicated isolated build sandbox.
- Do not deploy this starter as a public multi-user service without those controls.

## Current MVP limitations
- The agent currently generates a bounded set of files in one Gemini response (maximum 12 files), not an unlimited multi-step coding loop.
- Existing-repository mode currently collects the repository tree but does not download and fully understand every file. The update operation is therefore a prototype and should be used only on a test repository until deeper clone/read/diff/branch safeguards are implemented.
- The audit mode currently performs a repository tree inventory, not a complete static/security audit.
- Generated files are pushed through GitHub's Git Data API. Review the output and commit before production use.
- Deployment is not automated yet; deployment remains optional and can be added through a Vercel integration.
- The UI shows the chosen model in the response report. Model selection is automatic among models exposed by the user's Gemini API key; actual model access and quotas depend on Google's account/API configuration.

## Recommended GitHub token permissions
Use a fine-grained token with minimum required permissions. For new repository creation, configure repository creation access as required by GitHub; for an existing repository, grant Contents: Read and write and Metadata: Read. Never paste a token into a prompt or commit it to a repository.
