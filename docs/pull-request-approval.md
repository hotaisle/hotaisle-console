# Pull request approval policy

PRs authored by `jon-hotaisle` or `clint-hotaisle` do not need an approving review.
Every other author needs approval from either maintainer **on the current head commit**.
The policy identifies accounts by stable GitHub user IDs, not display names or commit
author metadata. Outstanding maintainer requests for changes remain blocking.

The organization ruleset requires the specific `required-maintainer-review.yml`
workflow, pinned to an inspected commit SHA. This is a required workflow, not just a
status name. Its checkout separately pins the TypeScript policy implementation to an
immutable commit, so contributor code and dependencies are never executed by the gate.
Changing a PR's workflow cannot replace the workflow required by the organization.
The gate needs only read permissions and makes its decision from fresh, paginated
GitHub PR/review API responses through `gh`, using the current REST API version.

Signed commits, an up-to-date branch, the `test` CI job, resolved review threads,
PR-only changes, and restrictions on branch deletion/force pushes remain mandatory.
No maintainer receives a ruleset bypass. Native blanket review count and last-push
approval must be disabled only after the required replacement workflow succeeds;
they cannot express the author exception. Stale-review dismissal stays enabled.

## Review updates

The default-branch `maintainer-approval.yml` controller reruns the required workflow
when reviews change its decision. An unprivileged `review-signal.yml` workflow wakes
it after submitted, edited, or dismissed reviews. A review signal forces a fresh
required check without trusting the signal's payload or artifacts. CI/policy workflow
completion and a five-minute schedule also reconcile state. GitHub can delay event
delivery and scheduled runs; this is not a synchronous merge webhook.

The controller reads current open PRs and matches policy runs to each PR and its
head commit. PRs sharing a commit are evaluated independently by the required workflow.
Comments do not cancel approval; dismissal or a subsequent review decision does.
Approvals of an earlier commit do not qualify. Missing or running policy workflows
are not fabricated or treated as successful. API errors fail the required check.

The controller executes trusted default-branch code, never PR source, artifacts,
dependencies, or caches. It can read source/reviews and rerun Actions workflows.
It does not approve reviews, publish successful statuses, change code, or merge PRs.
Its rerun requests are limited to matching review-policy workflows. Production deployment
is a separate main-only CI job using the protected production environment. Normal CI
and the review signal do not gain GitHub write permissions.

Until these controller workflows are merged to main, review changes may require a
manual rerun of the required workflow in GitHub. The organization rule itself can
enforce the pinned policy before that merge. No bootstrap PR is automatically merged.

## Maintaining the rule

Use GitHub's current organization rulesets API. Scope the required workflow rule to
this repository's default branch, with no bypass actors. The workflow SHA and its
policy-source checkout SHA are deliberate pins; changing policy requires updating
the pins after reviewing the new source. Keep the existing main ruleset's unrelated
protections intact and verify both effective rulesets after every change.

Fixture tests cover both author exemptions, both valid reviewers, other users/bots,
stale approval, comments, dismissals, change requests, independent PR refreshes,
and review-event invalidation. These tests do not simulate GitHub's event delivery.
Observe an actual required-workflow run before removing blanket native approval.

## Activation verified: 2026-11-11

The organization rule is active and scoped to this repository's default branch, with
no bypass actors. Its workflow source is pinned to `98a2f95`; that workflow checks
out policy implementation `c7d1c57`. The review workflow and `test` both passed on
PR #1, and GitHub reported that maintainer-authored PR as mergeable after the native
blanket approval requirement was replaced. Effective rules still require signatures,
CI, an up-to-date branch and resolved threads. No PR was merged during activation.
Third-party decisions were verified with fixtures, not by submitting a synthetic
approval or changing another contributor's PR.

The controller matches every policy run for the PR's current commit, including both
ordinary and organization-required runs when GitHub produces both. A successful
ordinary run must not prevent a failed required run from being refreshed after review.
Automatic review-event and scheduled reconciliation starts when the controller lands
on main; before then a manual rerun of the required workflow is necessary after review.
