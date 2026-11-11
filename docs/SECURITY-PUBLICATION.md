# Public security documentation

Everything committed to this repository must be suitable for public disclosure. Excluding `docs/`
from the deployed application does not make the files, pull requests, or Git history private.

## What belongs in public records

- Security boundaries and protocols already visible in this repository or its public interfaces.
- Public Console commit references, the scope/date of a review, resolved changes, and regression evidence.
- Dummy principals and clearly identified public test vectors. A public test vector must never be a
  deployment credential.
- Honest limits on verification. Distinguish historical observations, current source behavior,
  fixture results, and separately observed deployment behavior.

## What stays outside this repository

- Private keys, API/session tokens, approval links, claim tickets, cookies, recovery material,
  environment-file contents, credential-bearing URLs, and real user/team data.
- Local usernames/absolute paths, private hostnames/IPs, operational host inventories, and production
  control-plane identifiers or raw responses that are unnecessary to understand the public change.
- Private upstream source excerpts, file/function maps, internal revisions, counter capacities,
  deployment topology, and exact nonpublic abuse-control settings.
- Cloudflare membership or credential inventories, individual permission grants, raw Issues records,
  diagnostic request values, and internal export configuration.
- Reproduction payloads or procedural attack instructions for unresolved exploitable issues. Coordinate
  remediation and disclosure privately before publishing those details.

Public key material is not secret, but production trust entries belong in deployment configuration.
Document the registry format with placeholders; do not duplicate the live registry in security reports.
Cryptographic algorithms and public request-signing requirements are safe to document and must not be
treated as secret controls.

## Before publication

Review the complete Markdown and structured records, including links, code blocks, examples and any
attached images. Scan for credentials and identifying data without copying suspected values into logs
or a new public issue. Check that historical findings are explicitly dated and linked to their closure,
so old hypotheses are not represented as current confirmed vulnerabilities. Keep the evidence of a
fix; do not turn removal of operational detail into a claim that every security property was verified.

Check both the frontend output and the prebuilt Worker assets for documentation, audit records,
preview fixtures, credential files, and accidental source imports. The standard asset guard rejects
documentation copied into the frontend asset directory. Arbitrary stale prebuilt packages are outside
that guard's guarantee.

If a real secret is discovered in a commit, revoke or rotate it through an approved recovery plan.
Deleting it in a later commit does not remove earlier copies, forks, caches, or clones. Do not rewrite
shared Git history or rotate the browser-history encryption secret without explicit coordination.

## Disclosure review: 2026-11-11

The security Markdown and JSON records, the new email-login identity summary, and related README/agent
guidance were reviewed. Public conclusions and regression evidence were retained. Unnecessary private
upstream implementation details, production deployment fingerprints, and diagnostic access-inventory
details were removed from the current documents. The original structured audit baseline remains dated
and linked to its closure; it is not a current vulnerability queue. This is a documentation disclosure
review, not a new application audit or proof that public material can never help an attacker.

A targeted local scan of 15 current Markdown/JSON documents and 63 historical document blobs reachable
through the local Git references found no matching private-key blocks, common GitHub token/JWT values,
long secret assignments, embedded URL credentials, personal absolute paths, or private host patterns.
This heuristic check is not a complete secret scan of the repository, remote-only references, forks,
or external caches. The newly generated email-login private key was separately checked by exact value;
it was absent from the reviewed documents, built Worker bundle, and both generated asset trees.
Both asset trees contained only the 27 expected frontend files and no documentation/audit records.
No application build, live endpoint, hotManager command, or deployment was run during this disclosure review.
