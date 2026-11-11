# hotaisle-console

Originally created by [StayLameBro](https://github.com/StayLameBro) as
[hotaisle-ui](https://github.com/StayLameBro/hotaisle-ui), now maintained by Hot Aisle.
The original Git history and MIT license are preserved.

A web console for renting [Hot Aisle](https://hotaisle.ai) AMD MI300X GPUs. Sign in, choose a size and image,
hold to launch, SSH in, and end the machine when you're done. The drawing shows your servers and GPU state.

The React and TypeScript app uses TanStack Router for navigation and TanStack Query for server state.
A Cloudflare Worker serves the frontend, proxies the [Hot Aisle API](https://admin.hotaisle.app/api/docs/),
and saves launch details and run receipts as encrypted browser-local entries. Cloudflare does not persist
console history or per-user history keys.

## Screenshots

These views use simulated machines from the local development preview.

### Your machines

![Your machines dashboard with a running MI300X machine and server illustration](docs/machine.jpg)

### New machine

![MI300X size selection, cost estimate, and server illustration](docs/order.jpg)

## Development

Use Bun 1.4.4 and Node 26 LTS:

```sh
git clone https://github.com/hotaisle/hotaisle-console
cd hotaisle-console
bun install --frozen-lockfile
cp .dev.vars.example .dev.vars
# Set SESSION_SECRET and a separate HISTORY_SECRET in .dev.vars to 32+ random characters each.
bun run dev
```

The app is available at `http://localhost:8787`. It connects to the real API; launching, reserving, rebuilding,
ending machines, and purchasing credits have real effects.

To explore the machine UX without renting hardware, keep that development process running and build the
local preview:

```sh
bun run preview
```

Open [the machine preview](http://preview.localhost:8787/__preview/). The toolbar offers Empty, Assigned, Cloud-init,
Booting, Running, Multiple machines, Bare metal, Ended, History (200 runs), and Launch failure scenarios using the actual app components.
Choose Empty, then hold Launch to watch assignment and SSH readiness. Cloud-init adds a simulated booting phase. Try
ending a machine to see the minimum-charge confirmation and receipt. Reload or Reset returns to the selected
scenario; simulated changes are held only in memory.

Open [the bare-metal example](http://preview.localhost:8787/__preview/?scenario=bare-metal) for an assigned
8× MI300X server. Its More popup provides simulated bare-metal power operations and reinstall; End exercises
the eight-hour minimum and release receipt. Console opens a local, read-only mock console in a new tab;
its simulated API response never contains a real session URL.

The dedicated `preview.localhost` origin isolates browser storage from the normal console. No login is needed.
API calls are simulated in the browser, sockets are blocked, unknown operations fail locally, and checkout
is disabled. Its assets live in `web/preview-dist`, independently of production's `web/dist`, so normal builds
cannot overwrite the preview. A local Vite middleware serves only this isolated origin; it never falls back
to the real console or forwards real API requests. `bun run dev` prepares both outputs. Preview code is a
separate build entry outside `web/src`; normal builds exclude it. Production builds
and Worker packaging reject preview files or fixture code. Production requests to `/__preview/` return 404.
Run `bun run preview` again after changing preview components, or use `bun run --cwd web watch:preview`
in a development session when you want preview rebuilds on file changes. A missing preview shows build
instructions instead of redirecting into the real account. The normal console stays at `localhost:8787`.

```sh
bun run check             # Ultracite/Biome lint and formatting
bun run fix               # Apply supported fixes, then resolve remaining findings
bun run typecheck         # Tooling, Worker, app, and test types
bun run test              # Component and Worker projects
bun run test:components   # Vitest, Testing Library, jsdom
bun run test:worker       # Cloudflare's isolated Workers runtime
bun run build             # Frontend, then Worker packaging
```

Keep the existing development process running during browser verification. Frontend changes need
`bun run build:web`, or an already-running `bun run --cwd web watch` process.

The build footer links to the source pull request. Normal builds require a valid PR URL, resolved with
the authenticated `gh` CLI from the branch or commit. For an offline build, supply the verified URL with
`VITE_BUILD_PR_URL=https://github.com/hotaisle/hotaisle-console/pull/<number> bun run build`.
CI supplies the PR URL directly for pull-request builds and resolves it from the merged commit on `main`.

Bun manages the root, `web`, and `worker` workspaces with one `bun.lock`. Frontend tools, type checks, and helper
scripts run under Bun. Cloudflare's TypeScript configuration loader requires Node, so `cf`, the Worker bundler,
and Vitest orchestration use Node. Do not force those commands to run with `--bun`.

`web/dist/` is generated frontend output used by the Worker build. It is ignored by Git and can be deleted;
`bun run build` recreates it. Do not check build output or dependency directories into the repository.
Source, configuration, fixtures, and tests are TypeScript. Ultracite/Biome and EditorConfig use tabs; YAML uses
spaces as required by its syntax.

## Navigation

Pages use URLs for bookmarks and browser navigation. History URLs reopen after signing in to the same account
in the same browser. Encrypted history does not sync across devices or browser profiles.
The team chooser refreshes memberships and invitations every 30 seconds while active, and on returning to
the tab. Failed background updates keep the current list visible and offer a retry beside it.

| URL | Page |
| --- | --- |
| `/sign-in` | Email sign-in |
| `/sign-in/check-email` | Email approval |
| `/sign-in/key` | Save an API key locally |
| `/unlock` | Unlock the saved API key |
| `/teams` | Team selection |
| `/teams/new` | Create a team |
| `/teams/:team/machines` | Machines |
| `/teams/:team/machines/:kind/:deployment` | Selected machine |
| `/teams/:team/launch` | Launch a machine |
| `/teams/:team/settings` | Preferences and account |
| `/teams/:team/credits` | Credits checkout |
| `/teams/:team/settings#ssh-keys` | SSH keys |
| `/teams/:team/keys` | Redirects to SSH keys in Settings |
| `/teams/:team/image` | Cloud-init URL |
| `/teams/:team/history/:kind/:run` | An earlier run |
| `/teams/:team/history?page=2&pageSize=12` | Machine history, entries per page adapt to the panel's visible height |

Machine identity uses the API’s team, collection and `deployment_id`. In machine/history URLs, `:kind` is
`virtual_machines` or `bare_metal`, and the selected machine/run uses its deployment ID. Same-name
resources and successive rentals remain distinct; names are display labels. Legacy name-only URLs upgrade
when there is one match; ambiguous links ask you to choose a machine. Existing encrypted history
replays without rewriting stored entries; older entries without deployment IDs retain name-based identity. The local preview includes a same-name VM/bare-metal scenario.

Launch size and image are validated URL search parameters: `gpus` and `image`. Custom cloud-init
URLs stay in account-scoped encrypted browser storage.
Press `?` outside text fields for keyboard controls in the current page or action section. TanStack
Hotkeys scopes pause background commands in dialogs and menus. The list includes only enabled commands;
`C` copies the selected ready machine’s SSH command, and size/hold-to-launch shortcuts belong to the
launch view. Keyboard shortcuts can be disabled in Settings without disabling native control activation.

The theme selector is available before and after sign-in. Light, Dark, and System apply to every view and the server drawing, and persist in browser preferences.

Sign-in preserves the requested console destination. Worker assets use SPA fallback for direct page requests.

## Credentials and records

Availability refreshes every ten seconds while the browser is active, and on returning to it. Each browser makes
authenticated requests through the stateless proxy. There are no server-side rooms, socket tickets, or stored
team channels.

**API keys:** The browser encrypts the saved key with AES-256-GCM and a passphrase-derived key
(PBKDF2-HMAC-SHA-256, 600,000 iterations). Each saved copy gets a random salt and IV. Only ciphertext, salt,
IV, and a format version are saved in local storage. The passphrase is never sent to the server. Reloading
requires unlocking again; signing out clears the unlocked key from memory. Forgetting the saved key deletes
its encrypted local copy. Lost passphrases cannot be recovered.

After unlocking, each API request carries the key over HTTPS in its authorization header. The Worker forwards
it to Hot Aisle for that request. It does not create an API-key session cookie or persist API keys in a database
or application logs.
This stateless proxy avoids requiring CORS changes on the upstream API.

**Email sign-in:** The Worker handles Hot Aisle's email approval flow. Its claim ticket and resulting email-session
token stay in an AES-GCM encrypted, HttpOnly, Secure, SameSite=Strict cookie. Email sessions renew using the
upstream API's response headers. Legacy API-key session cookies are no longer accepted.

**Browser history:** Launch details and receipts are saved as append-only AES-256-GCM encrypted entries in
local storage, with a fresh random IV for each write. Entry IDs and account scope are authenticated with the
ciphertext. No names, team handles, receipts, or decryption keys are stored in plaintext. Both sign-in methods
unlock the same account's history automatically. The Worker verifies the credential with Hot Aisle before
deriving the key with HKDF-SHA-256 from a dedicated `HISTORY_SECRET`, the origin, and the account's verified
email and creation time. It returns the key in a non-cacheable response and never stores per-user keys.
The browser imports a non-extractable key and retains it only in memory. This is login-gated encryption;
the Worker can derive the key, and scripts executing in an unlocked session can access history.

**Custom cloud-init links:** The selected URL is encrypted in browser storage with the same account-scoped
key and a separate authenticated storage label. It is not stored in plaintext preferences or route search.
On the first successful unlock after this change, the browser encrypts an older `hotaisle-ui:prefs.customURL`
value and removes that plaintext field only after the encrypted write succeeds. A failed migration leaves
the old value intact and shows a warning. Existing bookmarked URLs may still contain an older `cloudInit`
query parameter; opening the console replaces that parameter in the current tab, but cannot erase browser
history or bookmarks created before this change.

Sign-out clears decrypted history, keys, and private caches, and signals other open tabs to lock. It never
clears encrypted history. Reload, account switches, and pruning of the active machine view do not delete
saved entries either. There is no automatic history expiry or retention deletion. Full storage or damaged
ciphertext produces a warning and preserves existing entries; unsaved new entries remain in memory.
Browser-managed eviction, clearing site data, or private browsing can still remove local storage.
Machines continue running in Hot Aisle independently of the browser. Notes are not a console feature.

Back up `HISTORY_SECRET` securely and preserve it across deployments. Changing it makes saved history
unreadable unless a key migration is implemented. Account email changes likewise require migration because
the current upstream user response has no immutable user ID. Missing configuration disables persistent
history with a visible warning; it never silently falls back to another key or replaces encrypted entries.

All active `/auth` and `/api` requests require the console's custom request header and reject a nonmatching
`Origin` when one is present. The proxy uses a configured upstream URL, forwards only the required headers,
and rejects upstream redirects. The Worker serves a Content Security Policy. Retired `/records/*` and `/live/*` endpoints
return 410 without accessing data bindings. Production Workers Logs and Issues are enabled, with invocation
logs and traces disabled. The configuration requires query-string redaction, which the
[2026-11-11 follow-up](docs/security-audit-2026-11-10/RESOLUTION-2026-11-11.md) confirmed in production.
Cloudflare may retain exception and issue
metadata, including request details. The application must not log credentials, account identifiers, or request bodies.
Security documentation is public on GitHub even though it is excluded from deployment assets; follow the
[publication policy](docs/SECURITY-PUBLICATION.md) before adding evidence or operational details.

The Worker configuration caps each production invocation at 1000 ms of CPU time and 10 subrequests.
Cloudflare enforces these resource caps only on its network. The Worker also rejects email-start bodies
over 1024 bytes and proxied API bodies over 1 MiB with HTTP 413, reading them incrementally instead of
calling `req.text()` or `req.arrayBuffer()`. CPU time does not include waiting on the Hot Aisle API.

Cloudflare Rate Limiting bindings guard the upstream calls. Email starts allow 3 per address and 10 per
client IP per minute; upstream credential checks allow 60 per IP per minute. Proxied API reads allow 120
per credential and path per minute, while writes allow 30 per credential per minute. This per-path read
limit leaves room for the console's polling across many machines. Exceeded limits return HTTP 429 with
`Retry-After: 60`; a limiter error returns 503 before the upstream call. The Worker sends only
purpose-separated HMAC digests to Cloudflare's temporary rate counters, never raw email addresses,
IP addresses, or API keys. These counters are separate from browser history and account data. Cloudflare
enforces binding limits approximately per location, so this is an abuse brake, not a strict global quota.

The next deployment permanently deletes the old `Account` and `Availability` Durable Object namespaces through
explicit `state: "deleted"` exports. Keep these deletion entries until Cloudflare confirms the classes are gone.
Do not re-export or bind the retired classes, or restore their data.

## Billing

Ending a virtual machine releases it with `DELETE` and deletes its data. VM actions follow HotManager's TUI:
state, start, graceful reboot, hard reset, rebuild, and delete. VM serial console access remains in the TUI.
Bare-metal actions include power state, a one-time console link, power on, graceful/forced shutdown,
warm/cold reboot, AC reset, reinstall, and release. Shutdown does not stop billing.
Minimum reservations come from the API: currently one minute
for 1-GPU VMs, 30 minutes per GPU for larger VMs, and eight hours for bare metal. The confirmation and estimated receipt account for the minimum. A failed release
must never be displayed as a successful end.

There is no automatic shutdown timer: the upstream API cannot schedule an end, and a browser timer could fail
while the machine continues billing. Add-credit checkout uses Hot Aisle's Stripe checkout link; this app does
not handle card details or claim a payment succeeded before confirmation.

## Repository workflow

Work on a descriptive branch and open a PR into `main`. PRs authored by `jon-hotaisle` or `clint-hotaisle`
can merge without approval. Other authors need either maintainer's approval of the current commit, enforced
by the pinned required workflow. Signed commits, resolved review threads, and the passing `test` CI job
remain required. The default branch blocks direct pushes, force pushes, and deletion, with no administrator
bypass. StayLameBro has write access and is requested to review PR #1.

CI runs lint, builds, deployment dry-run, types, and all test projects on GitHub-hosted Ubuntu 24.04.
Actions are pinned to exact commits. Fork workflows require approval and use a read-only repository token.
Hot Aisle's private runner group is not used for this public repository. CI does not publish deployments.

## Deploy

Deploy `hotaisle-console` to the Hot Aisle Cloudflare account that owns the active `hotaisle.app` zone.
The account ID is pinned in `worker/cloudflare.config.ts`.
The Worker configuration declares `console.hotaisle.app` as its production custom domain. Cloudflare manages
the domain's DNS record and TLS certificate; a separate CNAME to `workers.dev` is not needed.
All requests pass through the Worker so frontend assets and SPA pages receive its security headers.

Authenticate the CLI with a user who has access to that account before the first deployment:

```sh
bun run --cwd worker cf auth login
```

Email-login issuance uses a dedicated Ed25519 identity to appear as **Hot Aisle Console** on hotManager's
approval page. Generate it once:

```sh
bun run identity:email-login
```

This writes an ignored, owner-only `.cloudflare/email-login-identity/worker-secrets.json` containing
`EMAIL_LOGIN_SIGNING_KEY` (base64 PKCS#8 DER), plus `hotmanager-client.json` containing only its public
registration entry. The command refuses to overwrite an existing identity. Back up the private key securely;
never commit it, expose it to the browser, or reuse `SESSION_SECRET` or `HISTORY_SECRET` for signing.
Merge the public entry into hotManager's existing `EMAIL_AUTH_CLIENTS` JSON array, preserving other clients,
and activate that configuration before deploying the signed Worker. The client ID is `hotaisle-console`;
the server-configured display name is `Hot Aisle Console`.

The Worker signs only `POST /api/user/email/login/` using RFC 9421 with a SHA-256 content digest, a new
32-byte nonce, and a 60-second signature lifetime. The signature covers the method, canonical upstream
HTTPS URL, and exact serialized body. Redirects are never followed, and a missing or invalid key disables
email-login issuance instead of falling back to an unverified request. Existing sessions and API-key sign-in
are unaffected. Wait/completion requests are not signed. Start a new sign-in after rollout to see the verified
client name; existing unsigned approval links remain unverified.

For an existing Worker, upload the signing secret with the new build while retaining its existing secrets:

```sh
bun run build
bun run --cwd worker cf deploy --prebuilt --secrets-file ../.cloudflare/email-login-identity/worker-secrets.json
```

For local email-login development, add this generated `EMAIL_LOGIN_SIGNING_KEY` to the ignored `.dev.vars`
file using a local editor or secret tool; never paste it into shell command arguments or logs. Automated
tests use a public RFC 8032 test vector and an isolated verifier, with no real identity key or account.

For the first deployment, also configure independent random `SESSION_SECRET` and `HISTORY_SECRET` values in
the ignored `.dev.vars` file (32+ characters each), and back them up securely. Then upload them:

```sh
bun run build
bun run --cwd worker cf deploy --prebuilt --secrets-file ../.dev.vars
```

For an existing deployment, add `HISTORY_SECRET` once while preserving its current `SESSION_SECRET`.
For later deployments, use `bun run deploy` to retain all existing secrets. Never generate a new history secret as
part of routine deployment; saved browser history depends on it.

Deployment uses the `cf` CLI and Cloudflare Vite plugin to package and publish the prebuilt Worker. Their beta
versions are pinned in the workspace. `bun run --cwd worker cf deploy --prebuilt --dry-run` validates packaging
without publishing. Live account operations and production deployment still need separate verification.

Connect this Worker to `hotaisle/hotaisle-console` with Cloudflare Workers Builds. Watch only
the protected `main` branch and disable preview builds. GitHub Actions continues to validate
PRs; Cloudflare handles production builds and deployment when changes merge into main.
The [native GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
requires repository access through the Cloudflare Workers & Pages GitHub App.

Use the repository root and these build settings:

| Setting | Value |
| --- | --- |
| Build command | `bun run build:cloudflare` |
| Deploy command | `bun run deploy:cloudflare` |
| `NODE_VERSION` | `26.13.0` |
| `BUN_VERSION` | `1.4.4` |
| `SKIP_DEPENDENCY_INSTALL` | `1` |
| `CF_SEND_TELEMETRY` | `false` |

The build command installs frozen dependencies, runs lint/types/tests, builds the application,
and validates the prebuilt Worker. The deploy command publishes that same output through `cf`
only if its source is still the current main commit. It skips older revisions. Build metadata
retains the merged PR link using public GitHub metadata, so Cloudflare needs no GitHub API key.
These commands must be merged into main before the first successful native build.

Workers Builds still needs a build credential to deploy. Keep a dedicated, non-expiring user
token in Cloudflare's build configuration. [Workers Builds currently supports user tokens](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/#api-token),
whose Workers Scripts Edit permission covers the Hot Aisle account. Limit Workers Routes Edit
and Zone Read to `hotaisle.app`; do not add storage, billing or token-administration permissions.
GitHub Actions does not need a Cloudflare secret. The Worker's existing session, history and signing secrets
are retained by deployment and are not supplied to build commands. Never put build-token values
in source, command arguments, PRs or chat. Local checks do not validate the live native integration.

The main-only connection is active. See [the activation record](docs/cloudflare-builds.md)
for the verified settings and the first-build verification boundary.

See [AGENTS.md](AGENTS.md) for the source layout and implementation rules.

## Credits

The original developer is [StayLameBro](https://github.com/StayLameBro). The imported commit history preserves
GitHub authorship and contribution attribution.

Drawing kit: [Anatomy](https://github.com/wheresryan22/anatomy) by Ryan, MIT License
(`web/src/features/stage/iso/LICENSE-anatomy.txt`). Hardware references include Dell's PowerEdge XE9680 manuals,
AMD's MI300X data sheet, Hot Aisle's data-center information, and ServeTheHome's module photographs.

Digits: [DSEG](https://github.com/keshikan/DSEG) by keshikan, SIL Open Font License 1.1
(`web/src/assets/fonts/DSEG-LICENSE.txt`). Instrument Sans and IBM Plex Mono are also OFL licensed.

## License

MIT
