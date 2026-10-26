# GitHub Pages operations

## Deployment contract

| Property            | Value                                                            |
| ------------------- | ---------------------------------------------------------------- |
| Repository          | `Stumpowitch/Ajolis`, public, default branch `main`              |
| Production          | `https://ajolis.de/`                                             |
| Shared preview      | `https://ajolis.de/preview/`                                     |
| Deployed versions   | `https://ajolis.de/build-info.json`                              |
| Release format      | Annotated `vMAJOR.MINOR.PATCH` tag with GitHub-attested metadata |
| Production selector | Latest published immutable stable GitHub release                 |
| Environments        | `release` for publication, `github-pages` for deployment         |

Pages serves one site per repository. Production and preview are built separately
and assembled into one artifact. Production uses the verified release commit;
preview uses current validated `main`. The public preview carries `noindex,
nofollow`, but is not private and shares the production origin. Reserve `/preview/`
for the deployment pipeline. Missing preview routes use the site-wide production
404 document.

| Event                             | Result                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Pull request                      | CI, dependency audit, CodeQL; no publication                                                                  |
| Push to `main`                    | CI and security scans; successful CI updates preview while retaining the production release                   |
| Run `Release` on `main`           | Quality and security gates, version selection, changelog, attestations, release publication, Pages deployment |
| Run `Release` with `dry_run`      | Same gates, build, and attestation verification; candidate artifact only                                      |
| Run `Publish Pages`               | Verify and rebuild the latest release plus current main preview                                               |
| Publish a stable release manually | Pages verifies its provenance before deployment                                                               |
| No stable release                 | Pages skips publication                                                                                       |

The Release workflow calls Pages directly. A release created using `GITHUB_TOKEN`
does not itself trigger another workflow through the `release` event. No personal
access token, private signing key, or external signing service is needed.
[Workflow triggering](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)

## Publish with one workflow run

1. Merge the intended changes into `main` using TPM-signed commits.
2. Open [Actions → Release](https://github.com/Stumpowitch/Ajolis/actions/workflows/release.yml).
3. Select **Run workflow**, branch **main**, and a version increment: **patch**,
   **minor**, or **major**. The default is **patch**.
4. Leave **dry_run** disabled and start the workflow. This is approval to publish.

The workflow validates the exact selected commit with formatting, linting, tests,
Astro checks, workflow/shell/Nix checks, and both sandboxed site builds. It audits
production and development npm dependencies and scans JavaScript/TypeScript with
CodeQL's extended security queries. High/critical vulnerabilities and CodeQL
findings with security severity at least 7, or error-level results, block publication.
The SARIF gate also rejects missing reports and failed scans. Lower-severity
findings remain visible for review. These checks do not prove absence of flaws;
CodeQL does not replace Astro template linting or review of Nix and configuration.

After successful checks, the workflow:

1. Computes the next version from all existing stable tags, including reserved tags
   from interrupted runs. The initial version, if no tags exist, comes from the npm
   manifest. Versions are never reused or moved.
2. Generates English release notes from commits since the latest stable release,
   grouped by Conventional Commit type, with commit and comparison links.
3. Builds `ajolis.tar.gz`, records `release.json`, and computes `SHA256SUMS`.
4. Creates and verifies GitHub artifact attestations for the archive and metadata.
5. Checks that `main` still points to the validated commit. A concurrent main update
   causes publication to stop. The dry run exercises this preflight as well.
6. Creates an annotated tag, creates a draft with all assets, and immediately
   publishes it as the latest release and checks the resulting immutability before
   proceeding. No second approval click is needed. Release immutability must remain
   enabled in repository settings; the workflow token cannot read or change that
   admin setting, but a nonimmutable published result is rejected for deployment.
7. Calls the Pages workflow to publish production and preview.

Release versions live in Git tags and attested `release.json` / deployed
`build-info.json`. The private npm package version is a source-package baseline;
it need not change with each website release. This avoids automated unsigned
version-bump commits and unnecessary changes to the pinned npm dependency hash.

For a nonpublishing test, enable **dry_run**. All checks and attestation verification
run, and the candidate, changelog, and checksums are downloadable from Actions.
This creates public attestations but no tag, GitHub release, or Pages deployment.

Equivalent commands from the development shell:

```sh
gh workflow run release.yml --repo Stumpowitch/Ajolis --ref main -f bump=patch -F dry_run=true
# Publish after choosing the intended source and version increment:
gh workflow run release.yml --repo Stumpowitch/Ajolis --ref main -f bump=patch -F dry_run=false
```

## Release trust and repository protections

Code commits remain SSH-signed with the laptop TPM key. Automated release tags
use GitHub workflow attestations instead of a laptop signature. Pages checks:

- The published release is stable and immutable, with a valid release attestation.
- The tag is annotated and its commit belongs to `origin/main`.
- `release.json` matches the tag version and exact commit, and is an authentic
  immutable release asset.
- Its build attestation identifies `Stumpowitch/Ajolis`,
  `.github/workflows/release.yml`, `refs/heads/main`, and that exact source commit,
  and was created on a GitHub-hosted runner.

Only the existing bootstrap `v0.1.0` at
`61a5e392d4e9bf81b4a6aa0bc510f7d64b34965d` uses the older TPM verification path.
Retain the public `RELEASE_SIGNERS` Actions variable for this release. Never add
private keys as repository secrets. Missing attestations for newer releases fail
verification; there is no automatic downgrade to unsigned metadata.

For local verification, authenticate `gh` and run from the pinned shell:

```sh
git fetch origin --tags
node scripts/resolve-release.mjs v0.1.1
```

Set `RELEASE_SIGNERS` to the trusted SSH allowed-signers entry when verifying the
bootstrap version. Its authorized fingerprint is
`SHA256:Vs5ykT9xSrqZojws5aSL4bUlM8K4bHrkHSMYogDP980`.

Repository configuration:

| Setting                              | Value                                                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Name / visibility / default branch   | `Ajolis` / Public / `main`                                                                                            |
| Description                          | `Source for ajolis.de: an Astro website with reproducible Nix builds, attested releases, and a GitHub Pages preview.` |
| About website                        | `https://ajolis.de`                                                                                                   |
| Topics                               | `astro`, `typescript`, `nix`, `github-pages`, `static-site`                                                           |
| Actions default permissions          | Read repository contents and packages                                                                                 |
| Actions create/approve pull requests | Disabled                                                                                                              |
| Release immutability                 | Enabled before publication                                                                                            |
| Allowed actions                      | GitHub-owned actions, `github/codeql-action`, and `cachix/install-nix-action`                                         |

Workflow dependencies are pinned to commit IDs. Checkout credentials are not
persisted. Write permissions are scoped to the jobs that need them. The release
publication job has contents/attestations write access and OIDC; the deployment job
has Pages write access and OIDC. Release and Pages runs each serialize their work.

Use these active rulesets:

| Ruleset                    | Rules                                                                                | Bypass                                 |
| -------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------- |
| Main history integrity     | `main`: signed commits, no deletion, no force pushes                                 | None                                   |
| Main review and validation | `main`: pull requests, resolved conversations, up-to-date `Validate and build` check | Owner for local TPM-signed integration |
| Release tag integrity      | `v*`: no updates or deletions                                                        | None                                   |

Tag creation follows repository write permissions. The bootstrap owner-only
creation ruleset is disabled because GitHub's built-in Actions token cannot bypass
it. Tag updates/deletions remain blocked, and only releases with the expected
workflow provenance can deploy.

GitHub's signature requirement accepts trusted signatures generally, not only the
TPM key; repository contributor policy remains stricter. Use the maintainer bypass
only when the task authorizes it and all required validation has passed.

Configure environment **release** to allow only branch `main`, and **github-pages**
to allow branch `main` and tags `v*`. Neither environment requires reviewers or a
wait timer for the single-start workflow. Adding an environment reviewer deliberately
introduces another approval step.

## Domain verification, DNS, and HTTPS

In account [Settings → Pages](https://github.com/settings/pages), add and verify
`ajolis.de`. GitHub provides a TXT record named similar to
`_github-pages-challenge-Stumpowitch`. Use its exact displayed name and value,
complete verification, and retain the record.
[Domain verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)

In repository [Settings → Pages](https://github.com/Stumpowitch/Ajolis/settings/pages),
select **GitHub Actions** as the source and save **ajolis.de** as the custom domain
before changing traffic-related DNS records. No `gh-pages` branch or artifact
`CNAME` file is required.

At the authoritative DNS provider, configure:

| Type  | Name                                 | Value                    |
| ----- | ------------------------------------ | ------------------------ |
| A     | `@`                                  | `185.199.108.153`        |
| A     | `@`                                  | `185.199.109.153`        |
| A     | `@`                                  | `185.199.110.153`        |
| A     | `@`                                  | `185.199.111.153`        |
| AAAA  | `@`                                  | `2606:50c0:8000::153`    |
| AAAA  | `@`                                  | `2606:50c0:8001::153`    |
| AAAA  | `@`                                  | `2606:50c0:8002::153`    |
| AAAA  | `@`                                  | `2606:50c0:8003::153`    |
| CNAME | `www`                                | `stumpowitch.github.io.` |
| TXT   | GitHub's displayed verification name | GitHub's displayed value |

`@` denotes the zone apex; some providers use an empty name instead. The final dot
in the CNAME target marks an absolute DNS name. In zone-style editors it prevents
incorrect expansion to `stumpowitch.github.io.ajolis.de`. Providers that normalize
hostnames may display the correct value without the final dot.

Replace conflicting A/AAAA records at the apex and conflicting records at `www`;
retain unrelated mail and verification records. No `dev` record is needed.
A 300-second TTL is convenient during migration, but old cached records retain
their previous TTL. IPv6 records are optional; an old conflicting AAAA record must
still be removed when choosing IPv4-only hosting.
[GitHub DNS targets](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

After DNS resolves correctly and GitHub issues the certificate, enable **Enforce
HTTPS** in repository Pages settings. DNS propagation and certificate availability
can take up to 24 hours. A successful Actions deployment does not imply the DNS
or HTTPS certificate is ready.

## Troubleshooting and recovery

- **DNS check pending or failed:** inspect authoritative nameservers and a public
  recursive resolver separately. Correct authoritative answers with old recursive
  answers indicate caching; repeated edits do not clear those caches. Check both
  apex address families and `www`, including accidental suffix expansion.
- **Deployment succeeded but HTTPS fails:** inspect the Pages certificate status,
  DNS, and any restrictive CAA records. Do not disable certificate verification.
- **Quality or security gate failed:** inspect the failing job, fix the finding,
  commit and merge the correction, then start Release again. Do not weaken the gate
  simply to publish. Audit service failures stop publication as well.
- **Main changed during validation:** start a fresh Release run for current `main`.
- **Publication interrupted:** inspect tags, drafts, and release assets. Do not
  rewrite a tag. A fresh run reserves the next version. An unpublished draft may
  remain for inspection; the workflow does not automatically delete release data.
- **Release published but deployment failed:** fix the deployment problem and run
  **Publish Pages**. Do not create another release solely to retry deployment.
- **Rollback:** preferably revert the source with a signed commit and publish a new
  patch release. Alternatively mark a previously verified immutable stable release
  as latest and run Pages; the pipeline re-verifies its original provenance.

Candidate artifacts expire after 30 days; combined Pages archives after 90 days.
Immutable release assets persist independently of those Actions retention periods.
Project source uses [0BSD](../LICENSE); dependencies retain their own licenses.
