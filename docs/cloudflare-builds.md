# Native Cloudflare builds

## Active configuration

Verified on November 11, 2026 through the Cloudflare Builds API and dashboard:

- Repository: `hotaisle/hotaisle-console`.
- Automatic production builds: enabled for protected `main` only.
- Preview builds: disabled; exactly one production trigger exists.
- Repository root: `/`.
- Build command: `bun run build:cloudflare`.
- Deploy command: `bun run deploy:cloudflare`.
- Build variables: `BUN_VERSION=1.4.4`, `NODE_VERSION=26.13.0`,
  `SKIP_DEPENDENCY_INSTALL=1`, and `CF_SEND_TELEMETRY=false`.
- Build cache: enabled.

GitHub Actions continues to validate pull requests without production credentials.
Cloudflare builds and deploys after a merge changes main. The production helper
installs frozen dependencies, runs lint, type checks and isolated tests, builds
the application, and validates Worker packaging. Deployment uses that prebuilt
output and skips publication if main has advanced. The footer resolves the merged
PR from public metadata without a GitHub API credential.

## Credentials

A dedicated non-expiring user token is stored in Cloudflare Workers Builds.
Its active status and absence of an expiry were verified with Cloudflare's token
verification endpoint before registration. Its permissions are Workers Scripts
Edit for the Hot Aisle account, with Workers Routes Edit and Zone Read restricted
to `hotaisle.app`. It has no storage, billing or token-administration permissions.
[Workers Builds currently requires user-owned tokens](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#api-token);
the Workers Scripts permission covers the account rather than an individual Worker.

The unused expiring external-CI token was revoked. GitHub's production environment
has no Cloudflare token secret. Temporary plaintext credential files were removed
after registration. Token values, internal credential identifiers and dashboard
screenshots are not part of this repository.

Runtime session, history and email-signing secrets are separate from the build
credential. They were not changed or copied into the build environment. Routine
deployment must retain them, especially the history secret used to unlock existing
encrypted browser entries.

## Verification boundary

Connection activation did not start a build: the Builds API returned no build
records afterward. No merge or production deployment was performed during setup.
The older main revision lacked both native commands; each was checked against its
actual package and failed with `Script not found`, so it could not publish older
code through this configuration.

The first successful native build requires the build helpers to be merged into
main. Successful local checks and GitHub CI do not verify Cloudflare's build image,
GitHub webhook delivery, or a live deployment. Check the first main build and the
active Worker version after that merge. Never test this path by enabling preview
deployments or merging without the required repository checks.

## Current GitHub PR response

The first main build after PR #1 merged reached the build helper, then failed its
PR lookup. The helper requested API version `2026-03-10` but expected the older
`merge_commit_sha` field. That field is absent from both the associated-PR list
and the PR detail response in the current version; waiting and retrying did not
repair the mismatch.

The lookup now uses GitHub's [commit-specific PR association](https://docs.github.com/en/rest/commits/commits#list-pull-requests-associated-with-a-commit)
to identify the PR that introduced the source commit. It still requires a merged
PR targeting this repository's main branch and validates the GitHub URL. The
separate deployment check still rejects an outdated main revision. Regression
tests exercise the build helper with the current response shape and reject
unmerged or foreign-repository results. The corrected parser was also checked
against the actual public response for PR #1's squash commit using the same API
version and no authentication.

## Build assets before Worker tests

The next main build passed PR resolution, installed dependencies and reached the
isolated tests. Its CSP test received a 404 because the native helper ran tests
before creating frontend assets. A fresh Cloudflare build image has no generated
`web/dist` files; local cached assets had hidden that ordering error.

The native helper now builds before testing, as GitHub CI already does. Test
failures still stop publication, and the deployment dry-run follows the tests.
The orchestration regression verifies that asset generation precedes tests and
that packaging validation follows them. Generated assets remain ignored and are
not checked into Git.

A source-only copy without generated assets passed frozen dependency installation,
the production build, all 291 tests across 56 files, and the deployment dry-run
in this corrected order. This check did not use the local frontend output cache.

This document belongs under `docs/` and must remain outside the frontend assets
and Worker upload. The production asset guard enforces that exclusion.
