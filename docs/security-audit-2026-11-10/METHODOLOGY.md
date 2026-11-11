# Audit method and evidence log

## Scope and provenance

- Date: 2026-11-10.
- Baseline: `4e72d26ab835c2f678c31442116968d21a3a84ea` on `chore/adopt-hotaisle-console`; the worktree was clean before this audit.
- Scope: application, Worker, browser storage, authentication, team/machine/payment flows, production packaging, CI, and Cloudflare configuration. The uncommitted observability and asset-guard changes made during this review are called out separately.
- Method: the local `security-audit` skill and Cloudflare's identical upstream skill at commit `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8`, plus independent source analysis. The upstream skill was retrieved using `gh api`; no GitHub connector or browser was used.
- There was no compatible earlier Console audit ledger to carry forward. The coverage ledger records the actual source units and unresolved facts, rather than implying that one pass exhausts the application.

## Work performed

1. Four independent reconnaissance reviews mapped the stack, principals, entry points, source-to-sink paths, and safe execution boundary.
2. A first hunting wave reviewed Worker auth/proxy/history, browser vaults/launch/machine actions, and SSH instructions/build/deployment. An independent coverage critic identified six missed surfaces and two units whose candidate belonged to a different attack class.
3. A second wave reviewed email completion, team selection, checkout, history lifecycle, preview isolation, telemetry, request buffering, and the reassigned boundaries. The next two waves closed launch, SSH-key, stage, console-link, dependency, destructive-action, and team-creation gaps found by separate critics. A final-clean critic accepted no further work. Independent verifiers examined each surviving candidate and the final records.
4. The parent consolidated source references in `findings.json`, validated that file and `coverage-ledger.json` with the Cloudflare skill's validators, and derived the report from those records.
5. Production packaging was inspected from `web/vite.config.ts`, `worker/vite.config.ts`, and the deployment scripts. A guard was added to reject a `docs/` directory, Markdown files, and named audit records in `web/dist`; the normal deployment script also runs it. A read-only file listing found no audit documents in the existing `web/dist` output. No new build or packaged-artifact inspection was run; a direct deployment of a stale prebuilt artifact is outside this check.
6. At the user's request during the audit, `worker/cloudflare.config.ts` was changed to enable Workers Logs and Issues, disable invocation logs and traces, request query-string redaction, and persist diagnostic logs. After the source audit, a settings-only change was applied in the production Cloudflare dashboard through the Hot Aisle Chrome profile. The dashboard then showed Logs and Issues on, invocation logs and traces off, and query-string redaction still off. No application code or route was deployed. `README.md` and `AGENTS.md` describe this privacy boundary and the remaining live redaction gap.

## Checks and limits

The review used `rg`, `git status/log/ls-files`, direct file reads, local Cloudflare package type declarations, Cloudflare documentation, and the Cloudflare skill's JSON validators. A current tracked-file scan found no `.env`, private-key, or credential file, and no obvious private-key or common token pattern in the reviewed source. This is not a historical-secret or dependency-advisory scan.

Target-controlled tests, builds, fixture execution, browser flows, and `cf` deployment dry-runs were **not run** during the source audit. The available local sandbox was not shown to enforce all controls required by the audit skill: no external network, empty allowlisted environment, read-only source/toolchain, scratch-only writes, and explicit CPU, memory, process, file-size, disk, and wall-time limits. The skill therefore requires source-only review. No production request endpoint, real credential, purchase, or machine was probed. The later Cloudflare dashboard settings change was operational work, not a security test. Prior CI runs are not counted as security-audit reproduction.

At the end of the original source audit, only the dashboard observability toggles had been observed. The later owner-authorized deployment and ordinary regression checks are recorded separately below. The audit report must not be read as a certification of external controls or live machine/payment behavior.

## Operational follow-up: 2026-11-11

The owner requested grouped commits, a production deployment, and reconciliation of completed validation.
Public source `40fb99f` was deployed after ordinary
component/Worker tests, type checks, lint, a production build, and deployment dry-run passed. Read-only
Chrome verification confirmed the public sign-in links and production settings, including all five rate
limiters, Logs/Issues, disabled invocation logs/traces, persisted logs, and the CPU cap. No real sign-in,
email delivery, purchase, machine action, diagnostic error, or rate-limit exhaustion was exercised.

The new fixture checks were removed from the current work queue once their source fixes and regression
results were reviewed. Broader cross-kind naming, upstream mail policy, and Issues retention/access and
effective query redaction remain unresolved. [VALIDATION-2026-11-11.md](VALIDATION-2026-11-11.md) records
the evidence and limits. This operational evidence does not retroactively change the original source
audit's sandbox limitations or historical JSON verdicts.

The owner then requested inspection of hotManager and effective Cloudflare Issues settings. The final
follow-up inspected upstream source, identified
the lack of a cross-kind naming guarantee, and deployed a fail-closed duplicate-name guard with passing
fixture cases. The owner then requested full composite identity handling in place of rejecting
collisions; the resolution log documents the implementation and regressions. It traced the upstream email limiters and inspected the authenticated dashboard's actual
`script-settings` response, existing Issues metadata, and relevant access controls. Private upstream
details, access inventories, and raw diagnostic records are omitted from the public documentation.
Query redaction is confirmed enabled.
The final three questions are closed with explicit limits in [RESOLUTION-2026-11-11.md](RESOLUTION-2026-11-11.md).

## Relevant vendor documentation

- [Cloudflare security-audit-skill source](https://github.com/cloudflare/security-audit-skill/tree/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit)
- [Workers Request redirects](https://developers.cloudflare.com/workers/runtime-apis/request/): followed Worker subrequest redirects can forward credential headers to another origin.
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/): Worker memory and request-body limits differ; buffering large bodies can exceed memory.
- [Cloudflare CLI configuration explorer](https://developers.cloudflare.com/cf/projects/config-explorer/): `observability` property names and defaults.
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/) and [Issues](https://developers.cloudflare.com/workers/observability/issues/investigate/): persistence and issue diagnostic context.
