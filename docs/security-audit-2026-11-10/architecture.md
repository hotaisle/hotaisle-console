# Architecture and audit scope

This is a source-only, standard-profile audit of the public Hot Aisle Console at commit `4e72d26ab835c2f678c31442116968d21a3a84ea`. There was no compatible prior Console audit ledger. The repository was clean before the audit documents were added. The audit covers `worker/`, `web/`, `shared/`, GitHub Actions, and the Bun lockfile. It does not test deployed Cloudflare settings, the Hot Aisle API, live users, purchases, or machines.

## Principals and protected resources

An anonymous visitor can load static assets and start email approval. An authenticated person uses an encrypted email-session cookie or an API key unlocked from browser-local ciphertext. Team members can select teams, launch and manage machines, add SSH keys, and open Stripe checkout. The upstream Hot Aisle API is the ultimate authority for team membership, machine actions, billing, and key management. The Worker is a same-origin gate and stateless proxy; it should not retain user records or API keys. The browser holds encrypted API-key and machine-history entries.

## Paths and boundaries

Production HTML enters `web/src/main.tsx` and the TanStack Router; URL state is validated in `web/src/app/route-state.ts`. Browser calls use `web/src/lib/api.ts` and cross the same-origin Worker at `worker/src/index.ts`. `/auth` manages email approval and history-key derivation; `/api` forwards to a fixed upstream URL. Cookie encryption is in `worker/src/session.ts`; history-key derivation is in `worker/src/history-key.ts`; upstream protocol calls are in `worker/src/hotaisle.ts`. API-key and history vaults are in `web/src/lib/key-vault.ts` and `web/src/lib/history-vault.ts`. Machine operations, launch choices, and browser links are under `web/src/features/`.

The Worker requires `X-Requested-With` and checks a present `Origin`; encrypted cookies are HttpOnly, Secure, and SameSite=Strict. The stateless API-key route forwards the key only per request. The proxy uses a fixed upstream base and manual redirect handling. History entries are encrypted in localStorage and never sent to Cloudflare storage. Workers Logs and Issues are enabled in source configuration, with invocation logs and traces disabled and query-string redaction requested. A later production dashboard settings change enabled Logs and Issues and disabled invocation logs, but query-string redaction remains off live. Issues may retain request and exception metadata; its exact payload and access controls were not inspected.

`bun run build` builds `web/dist` and packages that directory as Worker assets through `worker/vite.config.ts`; `web/preview-dist` is a separate local-only output. Production rejects `/__preview`. CI validates on GitHub-hosted runners and does not publish. The root `docs/` directory lies outside `web/dist`. The audit adds a packaging assertion that rejects documentation artifacts if copied into the asset tree.

## Execution limits and companion selection

The source offers isolated Worker fixtures and component tests, but this run did not execute target-controlled code. The available local sandbox was not shown to enforce every required CPU, memory, process, disk, file-size, wall-time, environment, network, and write-isolation control. Accordingly, source-visible paths are reviewed and uncertain runtime or deployment effects remain `needs_validation`. The selected Cloudflare skill companions are web protocol and auth, client-side, cloud and deployment, data isolation and lifecycle, supply chain and release, and resource exhaustion and availability. Native, AI, mobile, and generic RPC companions do not match a material source-visible boundary in this target.
