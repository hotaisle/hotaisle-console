# AGENTS.md

hotaisle-console is a React and TypeScript console for Hot Aisle GPU rentals, served by a Cloudflare Worker.
Keep the original developer's credit at the top of the README, the imported Git history, and license notices.

## Commands

```sh
bun install --frozen-lockfile
bun run check
bun run typecheck
bun run test
bun run build
bun run --cwd worker cf deploy --prebuilt --dry-run
```

Run the Worker suite before every commit. Component tests are colocated with their source components and hooks;
Worker tests run in Cloudflare's isolated runtime with a test-only upstream fixture. Never use real accounts,
credentials, purchases, or machine operations in automated tests.
All test projects must freeze time through the shared test setup. Use fake timers and explicit
advancement for elapsed-time behavior, or controlled promises for in-flight work. Never add sleeps,
real-time delays, or assertions that wait for wall-clock time to pass. Test fixtures in separate
runtimes must receive the same controlled clock; native binding internals may need deterministic
test doubles when their clocks cannot be overridden.

Use Bun 1.4.4 for package management, frontend tools, TypeScript checks, and helper scripts. Source, configuration,
fixtures, and helpers must be TypeScript, not JavaScript module scripts. Cloudflare's configuration loader requires
Node module hooks, so the `cf` CLI, Worker build, and Vitest orchestration use Node 26 LTS. Do not force `--bun` on them.

Use Ultracite/Biome with tabs and fix reported issues. Do not add rule suppressions to make checks pass. YAML uses
spaces. Generated `web/dist`, Worker output, and dependency directories are ignored and must not be committed.
`bun run build` recreates frontend assets before packaging the Worker.

## Source layout

| Path | Responsibility |
| --- | --- |
| `web/src/app/` | App entry, Router route tree, URL validation, Query client |
| `web/src/features/auth/` | Email approval, API-key encryption and unlock forms, sign-in layout |
| `web/src/features/console/` | Console orchestration, data hooks, panel views, credits |
| `web/src/features/launch/` | Size selection, launch guards and images |
| `web/src/features/machines/` | Machine readings, actions, confirmations, receipts and history |
| `web/src/features/settings/` | Account, browser preferences and SSH key management |
| `web/src/features/stage/` | Server layout, animation controller, SVG rendering and geometry |
| `web/src/components/` | Shared controls and readouts |
| `web/src/hooks/` | Query-backed resources and session cache lifecycle |
| `web/src/lib/` | Typed API, encrypted key vault, formatting and browser utilities |
| `web/src/styles/`, `web/src/assets/` | Stylesheets and licensed static assets |
| `web/test/` | Component test setup and providers |
| `web/dev/`, `web/__preview/` | Local-only machine preview, simulated transport and scenario entry |
| `worker/src/index.ts` | Request guard, email sign-in, stateless key proxy |
| `worker/src/session.ts` | Encrypted email-session cookies |
| `worker/src/history-key.ts` | Stateless, authenticated browser-history key derivation |
| `worker/src/hotaisle.ts` | Upstream API and email protocol adapter |
| `worker/test/fixtures/upstream.ts` | Isolated upstream fixture; never imported by production code |
| `worker/cloudflare.config.ts` | Worker assets, secrets and retired namespace deletion exports |
| `worker/vite.config.ts` | Worker build and local development configuration |
| `shared/records.ts` | Pure machine-record and recent-history logic |

## Navigation and state

Use TanStack Router for every page. Team, selected machine, history run, and launch choices belong in validated
URL parameters, so links, reloads, and browser back/forward work. Do not reintroduce an in-memory page stack.
The custom cloud-init URL is the exception: keep it in account-scoped browser ciphertext, never route search
or plaintext preferences. Migrate legacy `hotaisle-ui:prefs.customURL` only after an encrypted save succeeds.
A protected link must retain its destination through sign-in. Unknown machines and missing history must not
silently display another machine or an unrelated page.
Keep ended runs in the dedicated history view, with pagination and page size in URL parameters and no search UI.
Fit each page to the panel's visible height, keeping text fully readable. Persist launch records and receipts only as AES-GCM encrypted, append-only browser entries.
Never automatically delete or overwrite saved entries on logout, account changes, retention limits, quota
errors, decryption errors, or upgrades. Clear only decrypted memory and keys on logout and authentication
failure. Do not persist plaintext or history keys. Never persist history to Cloudflare. There is no notes feature.

Use TanStack Query for API state and polling. Scope resource keys by team and clear private caches when the
account changes or signs out. Cancel older polls before optimistic cache writes; await those writes before
refreshing. Keep component behavior covered by focused tests instead of a whole-app stability script.

Availability polls from the browser every ten seconds through the stateless proxy and refreshes on focus.
Do not add server-side rooms, tickets, or user-data storage. The old Account and Availability Durable Object
exports are deletion tombstones; never re-export or bind the retired classes. Workers Logs and Issues are
enabled, with invocation logs and traces disabled. Query-string redaction is required and was verified
in the 2026-11-11 follow-up; recheck effective settings after observability changes. Never add credentials, account
identifiers, request bodies, or other user data to application logs or issue context.
The only Worker-side rate state is Cloudflare's temporary counters keyed by purpose-separated HMAC digests;
never send raw emails, IP addresses, or API keys to a rate-limit binding. Binding limits are approximate
per Cloudflare location, not strict global quotas.

Use TanStack Form for form values, field validation, and submission state. Reuse the bound controls in
`web/src/components/forms/`. Team creation and invitation acceptance use the upstream API; keep pending
invitations visible and update the account cache from the successful response before navigating.
Do not leave empty directories behind when moving source files.

`bun run preview` builds a local-only scenario explorer for the already-running development process at
`http://preview.localhost:8787/__preview/`. It uses the real app components with browser-only fixtures and no
real API fallback. Keep preview imports outside production entry points. Its separate origin isolates browser
storage; reload resets simulated state. Preview assets use the independent `web/preview-dist` output, served
only by local Vite middleware; production builds must not overwrite it. Missing preview assets must fail
clearly, never use the normal SPA fallback. Reject real `/api` and `/auth` requests from the preview origin.
Normal builds exclude the preview and Worker packaging must reject
preview assets. Never deploy the preview build or use real credentials for it.

## Credentials and privacy

API keys are saved only as browser-local ciphertext, using a passphrase-derived, non-extractable AES-GCM key.
Use a new random salt and IV for every save. The passphrase never leaves the browser. After unlocking, the
browser sends the API key to the same-origin Worker in an authorization header for each request. The Worker
may see the key while forwarding it; it must never persist it in a cookie, database, cache, or application log.
The Worker must never persist account records or history.

Browser history unlocks with either sign-in method through `POST /auth/history-key`. Verify the credential
with Hot Aisle on every key request; derive only from the verified account identity, never client-supplied
identity fields. Use the dedicated `HISTORY_SECRET`, origin separation, and `Cache-Control: no-store`.
Do not fall back to `SESSION_SECRET`. Preserve `HISTORY_SECRET` across deployments and back it up securely;
rotation requires a recovery/migration plan. The current API identity is email plus account creation time,
so an email change requires migration too. The Worker can derive the key but stores no per-account keys.
Keep the preview's fixtures memory-only. Failed unlock or storage writes must show a visible warning and
preserve ciphertext; new entries may remain memory-only while storage is unavailable.

Email sign-in uses an encrypted HttpOnly, Secure, SameSite=Strict cookie. Its claim ticket and email-session
token never enter frontend response bodies. Old API-key session cookies are rejected. Never log credentials,
passphrases, claim tickets, or emails. Login sessions live in encrypted browser cookies; there is no account database.

Keep the same-origin guard, custom request header, CSP, fixed upstream destination, and manual redirect handling.
Do not add endpoints that store API keys or return session secrets to the page.

The upstream email flow uses `/user/email/login/`, `/user/email/wait/`, and `/user/email/complete/`. Approval uses
202 while waiting and 204 when approved; completion returns its token through response headers. Renewal keeps
the later expiry so an older response cannot replace a newer session.
Email-login issuance must use the `hotaisle-console` RFC 9421 Ed25519 client identity. Keep its dedicated
`EMAIL_LOGIN_SIGNING_KEY` private to the Worker and register only the public key in hotManager's
`EMAIL_AUTH_CLIENTS`. Sign the exact JSON bytes, canonical HTTPS upstream URL, and POST method with a
fresh 32-byte nonce and at most 60-second lifetime. Never fall back to unsigned issuance, reuse session/history
secrets, follow signed redirects, or sign unrelated endpoints. Tests use only a public test-vector key.

## Money and behavior

- End must release the machine through `DELETE`; shutdown does not stop billing. Explain that release deletes data.
- Prefer the API's `MinimumReservationMinutes`. HotManager's current fallback is one minute for a 1-GPU VM,
  30 minutes per GPU for larger VMs, and eight hours for bare metal.
- Failed releases, launches, and purchases must stay failures in the UI. Never synthesize successful results.
- There is no browser-managed auto-end timer. The API must support scheduled shutdown before one can be promised.
- Keep instrument widths stable and respect reduced motion. The drawing sleeps while idle and writes only changed values.
- Use native controls and labels, native dialogs for modal interaction, and accessible links for navigation.
- Show transient errors through the shared out-of-flow error notices, never by inserting visible error rows
  or retry controls into page layout. Keep field errors associated with invalid inputs and dialog notices
  inside the dialog's accessibility scope; dismissing a notice must not change validation or operation results.

## GitHub workflow

Before creating or updating a PR, assess whether the diff changes anything shown in Console media:
layout, copy, controls, navigation, team/billing/machine flows, hardware visuals, themes, or the showcase.
Follow `docs/media-sync.md` to keep README screenshots, website/blog images, video, captions, transcript,
and poster synchronized. If affected media has not already been refreshed for the current changes,
ask the user whether to sync it before opening the PR. Do not silently omit this question or treat
an earlier refresh as covering later UI changes. An explicit request to regenerate media already
authorizes the sync; proceed without asking again. For an explicit release with instructions not to
pause, complete the affected sync within that authorization. State the media result in the PR body:
refreshed (with related PRs), not affected (why), or deferred (the user's decision and remaining scope).
This is a manual workflow check; existing CI does not detect stale screenshots or videos.

Treat all tracked documentation as public, including security records. Follow
`docs/SECURITY-PUBLICATION.md` before updating them. Do not include credentials, production key material,
personal/local paths, private upstream internals, host inventories, raw diagnostics, or control-plane
access inventories. Coordinate unresolved exploitable issues privately before publishing reproduction
details. Docs remain outside production assets, but that does not make Git history confidential.

Use a descriptive non-default branch; never commit directly to the default branch. Use `gh` for GitHub operations.
Keep commits small, coherent, and conventional. PRs by `jon-hotaisle` or `clint-hotaisle` do not require approval;
other PRs require either maintainer's current-commit approval through the pinned organization-required
`required-maintainer-review.yml` workflow. Do not replace it with a status-name-only rule.
Keep signed commits, resolved review threads, and the `test` CI job required; do not add ruleset bypasses.
See `docs/pull-request-approval.md` for controller trust and activation. Never switch accounts to manufacture
approval. This public repository uses GitHub-hosted
Actions, not Hot Aisle's private runners. GitHub CI validates without production credentials.
Cloudflare Workers Builds watches only protected `main`, with previews disabled. Use Bun 1.4.4 and Node 26,
`bun run build:cloudflare` to install frozen dependencies and validate/build, then `bun run deploy:cloudflare`
to publish that prebuilt output through `cf`. Keep build credentials in Cloudflare, without an expiration;
do not pass runtime session/history/signing secrets through either CI system or rotate them during deployment.
Production build helpers verify the main source commit and resolve its merged PR from public metadata.
An older build must skip publication when main advances. Never deploy local preview assets or PR branches.

## Compatibility and verification limits

Use Google Chrome's Hot Aisle profile through the Chrome relay for browser work on this project.
If that profile is unavailable, report it; do not use another profile as a fallback.

Keep the existing `hotaisle-ui:prefs` and `hotaisle-ui:team` browser identifiers so preferences remain readable.
Preserve the HKDF salt unless an explicit credential migration is implemented.
Local component tests, isolated Worker tests, builds, and deployment dry-runs do not validate live sign-in,
real purchases, real machine lifecycle operations, or production deployment.
