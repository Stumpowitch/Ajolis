# GitHub Pages operations

## Deployment contract

| Property               | Value                                          |
| ---------------------- | ---------------------------------------------- |
| Repository             | `Stumpowitch/Ajolis`                           |
| Visibility             | Public                                         |
| Default branch         | `main`                                         |
| Production             | `https://ajolis.de/`                           |
| Shared preview         | `https://ajolis.de/preview/`                   |
| Provenance             | `https://ajolis.de/build-info.json`            |
| Release format         | SSH-signed annotated `vMAJOR.MINOR.PATCH` tags |
| Production selector    | GitHub's latest published stable release       |
| Deployment environment | `github-pages`                                 |

GitHub Pages serves one site per repository. Both variants are therefore published
as one artifact. Production is built from the verified release commit; preview is
built separately from `main`. A normal main-branch update rebuilds both variants
while preserving the selected production source version. The workflow always
rebuilds from source rather than trusting artifacts supplied by a pull request.
[Pages site types](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

| Event                                       | Result                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------- |
| Pull request                                | Validation and downloadable candidate artifact; no publication          |
| Push to `main`                              | Validation, then combined deployment using the latest stable release    |
| Push a signed `v*` tag                      | Candidate validation, including signature, ancestry, and version checks |
| Create a draft release                      | No publication                                                          |
| Publish a prerelease                        | No production deployment                                                |
| Publish a stable release and mark it latest | Rebuild and publish the selected release plus current main preview      |
| Run `Publish Pages` manually                | Rebuild the latest stable release plus current main preview             |
| No published stable release                 | Skip publication until the first release exists                         |

Publishing the stable release is the production approval. Creating or pushing a tag
alone does not release it. An additional environment approval would pause every
combined deployment, including preview updates. The recommended setup uses release
publication as the approval and leaves automatic preview updates enabled.

The preview is public and shares the production origin. Its `noindex, nofollow`
metadata is an indexing instruction, not authentication or a security boundary.
Do not preview confidential content or untrusted code. Preview cookies, browser
storage, and service workers require particular care if introduced later. Reserve
`/preview/` for the deployment pipeline. Missing preview routes use the production
404 document because Pages provides one site-wide fallback.

## 1. Create the repository

Create an empty repository at <https://github.com/new>:

| Setting                                   | Value                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Owner                                     | `Stumpowitch`                                                                                                       |
| Repository name                           | `Ajolis`                                                                                                            |
| Description                               | `Source for ajolis.de: an Astro website with reproducible Nix builds, signed releases, and a GitHub Pages preview.` |
| Visibility                                | Public                                                                                                              |
| Initialize README, .gitignore, or license | Leave all disabled; the local repository already contains its metadata                                              |

Set the About website to `https://ajolis.de` and use topics such as `astro`,
`typescript`, `nix`, `github-pages`, and `static-site`. The repository does not need
to be named `Stumpowitch.github.io`. Public source visibility does not grant a
distribution license; the package remains `UNLICENSED`.

## 2. Configure identity and release trust

In account **Settings → SSH and GPG keys**, register `~/.ssh/id_ecdsa.pub` as a
signing key. Register the same public key separately as an authentication key if
SSH pushes are not already configured. Never upload `id_ecdsa.tpm` or a private key.

In repository **Settings → Secrets and variables → Actions → Variables**, add:

| Variable          | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| `RELEASE_SIGNERS` | An OpenSSH allowed-signers entry for the authorized TPM public key |

Generate the exact value locally:

```sh
printf '%s namespaces="git" %s\n' "$(git config user.email)" "$(cat ~/.ssh/id_ecdsa.pub)"
```

Paste the complete output as one line. This is public verification data and belongs
in a repository variable, not a secret. The authorized laptop key fingerprint is
`SHA256:Vs5ykT9xSrqZojws5aSL4bUlM8K4bHrkHSMYogDP980`. Multiple explicitly trusted
signers can be listed on separate lines when rotating keys. Retain trust for older
releases that must remain rebuildable.

The workflows use the automatic `GITHUB_TOKEN` and Pages OIDC authentication.
No personal access token, deployment key, DNS credential, or private signing key is
required in Actions. GitHub never needs access to the TPM; tags are signed locally
and verified in CI.

## 3. Push the existing history and configure Actions

Run from the project directory after creating the empty repository:

```sh
git remote add origin git@github.com:Stumpowitch/Ajolis.git
git push -u origin main
```

If `origin` already exists, inspect `git remote -v` instead of adding it again.
The first `CI` run should pass. `Publish Pages` will skip deployment because no
stable release exists yet. A skipped first publication is expected.

In **Settings → Actions → General**:

- Enable GitHub Actions. If using an action allowlist, allow GitHub-owned actions
  and `cachix/install-nix-action`; all referenced actions are pinned to commit IDs.
- Set default workflow permissions to **Read repository contents and packages**.
  The Pages deployment job explicitly requests `pages: write` and `id-token: write`.
- Leave **Allow GitHub Actions to create and approve pull requests** disabled.
- Retain workflow artifacts for 90 days if available. Candidate artifacts use 30
  days, combined archives 90 days, and transient Pages artifacts 7 days.

The `CI` check is named **Validate and build**. It runs formatting, ESLint,
behavioral release tests, Astro type checks, shell and workflow checks, and both
Nix builds. No workflow creates commits, signs on behalf of a maintainer, or pushes
branches.

## 4. Verify the domain and configure Pages

Before directing traffic to Pages, open account **Settings → Pages → Add a domain**
and verify `ajolis.de`. GitHub supplies a TXT record resembling:

| Type | Name                                  | Value                                        |
| ---- | ------------------------------------- | -------------------------------------------- |
| TXT  | `_github-pages-challenge-Stumpowitch` | The exact verification value shown by GitHub |

Use the displayed record name and value, finish verification in GitHub, and retain
the TXT record afterward. Verification belongs to account settings, not repository
settings. [Domain verification](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages)

In repository **Settings → Pages**:

1. Set **Build and deployment → Source** to **GitHub Actions**.
2. Set **Custom domain** to `ajolis.de`, without a scheme, slash, or path.
3. Save the domain before changing the traffic-related DNS records below.
4. Enable **Enforce HTTPS** once GitHub has issued the certificate.

Do not select a publishing branch or create a `gh-pages` branch. An Actions-based
Pages deployment does not use a `CNAME` file from the artifact; the custom domain is
configured in repository settings.
[Custom-domain configuration](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

Under **Settings → Environments**, configure `github-pages`:

| Setting                      | Value                              |
| ---------------------------- | ---------------------------------- |
| Deployment branches and tags | Selected branches and tags         |
| Allowed branch               | `main`                             |
| Allowed tag pattern          | `v*`                               |
| Required reviewers           | None for automatic preview updates |
| Wait timer                   | None                               |
| Environment secrets          | None                               |

If Pages has not created the environment yet, create it with this exact name. Both
branch and tag policies are needed because main CI completions and release events
use different Git refs. To require a second explicit click on every publication,
add yourself as a required reviewer; for a solo maintainer, keep **Prevent self-review**
disabled. This also requires approving preview updates.
[Environment protection rules](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)

## 5. Configure DNS

At the DNS provider for `ajolis.de`, use these records. A TTL of 300 seconds is
convenient during setup; the provider's normal default is also sufficient.

| Type  | Host/name                         | Value                       |
| ----- | --------------------------------- | --------------------------- |
| A     | `@`                               | `185.199.108.153`           |
| A     | `@`                               | `185.199.109.153`           |
| A     | `@`                               | `185.199.110.153`           |
| A     | `@`                               | `185.199.111.153`           |
| AAAA  | `@`                               | `2606:50c0:8000::153`       |
| AAAA  | `@`                               | `2606:50c0:8001::153`       |
| AAAA  | `@`                               | `2606:50c0:8002::153`       |
| AAAA  | `@`                               | `2606:50c0:8003::153`       |
| CNAME | `www`                             | `stumpowitch.github.io`     |
| TXT   | GitHub's verification record name | GitHub's verification value |

The AAAA records are optional IPv6 support; retain the A records when using them.
The CNAME target is the account hostname without `/Ajolis`, not `ajolis.de`.
GitHub redirects `www.ajolis.de` to the configured apex domain. No `dev` DNS record
is needed for a path-based preview. Remove conflicting parking/hosting records
for `@` and `www`, while retaining unrelated mail and verification records. Avoid
wildcard records. If the provider offers HTTP proxying, use ordinary DNS resolution
for the initial Pages certificate setup.
[Pages DNS and HTTPS configuration](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)

DNS propagation and certificate issuance may take time. If HTTPS remains pending,
check for conflicting A/AAAA records and, if CAA records exist, whether they permit
GitHub's certificate authority. Use the current GitHub troubleshooting guidance
before changing a restrictive CAA policy.
[Domain troubleshooting](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/troubleshooting-custom-domains-and-github-pages)

## 6. Protect history and releases

After the initial push and successful CI run, configure **Settings → Rules → Rulesets**.

For `main`, enable an active branch ruleset with:

- Block force pushes and branch deletion.
- Require signed commits.
- Require a pull request and the **Validate and build** status check from GitHub
  Actions. Require the branch to be up to date before merging.
- Require conversation resolution. For solo maintenance, do not require another
  approving reviewer; use at least one reviewer when a second maintainer exists.

GitHub's signed-commit rule recognizes trusted signatures generally; it does not
enforce the specific TPM key. GitHub-created merge commits use GitHub's signing key.
For strictly TPM-only project history, merge locally with signed commits and use
a narrowly scoped maintainer bypass for the pull-request rule. Keep required checks
and explicit review as part of that process. Agents must not use a bypass unless
the task explicitly authorizes it.

For `v*`, add an active tag ruleset that restricts updates and deletions. Restrict
tag creation to release maintainers if multiple people have write access. CI checks
the actual tag signature independently of GitHub's ruleset capabilities.

In **Settings → General → Releases**, enable **release immutability** before the
first publication. This protects published release tags and assets. Create drafts
and attach any desired assets before publishing; workflow archives are retained as
Actions artifacts and are not automatically appended to immutable releases.
[Immutable releases](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes)

Enable automatic deletion of merged feature branches if desired. Keep `main` as
the default branch. Issues can remain enabled; Discussions, Wiki, and Projects are
optional and are not used by the deployment system.

## 7. Publish the first release

The initial version is `0.1.0`. The first tag must include the deployment workflow
and production/preview build support. Do not tag the earlier scaffold commits.

From the pinned development environment:

```sh
git switch main
git pull --ff-only
just validate
nix flake check
git status --short

# Continue only with a clean working tree and the intended committed source.
git tag -s v0.1.0 -m "Release 0.1.0"
git verify-tag v0.1.0
git push origin v0.1.0
```

Wait for the tag's **CI → Validate and build** check to pass. Inspect the
`candidate-<commit>` artifact if needed. Then open **Releases → Draft a new release**:

- Select the existing `v0.1.0` tag; do not create a lightweight tag in the UI.
- Use title `v0.1.0` and technical English release notes.
- Keep the release as a draft until it is approved for production.
- Leave **Set as a pre-release** disabled.
- Select **Set as the latest release** when publishing.

Equivalent GitHub CLI commands, after authenticating `gh` locally:

```sh
gh release create v0.1.0 --repo Stumpowitch/Ajolis --verify-tag --draft \
  --title "v0.1.0" \
  --notes "Initial static website with reproducible builds and a shared preview."

# Execute when the validated release is approved for production.
gh release edit v0.1.0 --repo Stumpowitch/Ajolis --draft=false --latest
```

`Publish Pages` verifies the tag against `RELEASE_SIGNERS`, checks that its commit
belongs to `main`, and confirms that tag, `package.json`, and lockfile versions agree.
It builds production from that exact commit and preview from current `main`, then
publishes the combined artifact. Check the Actions run and **Settings → Pages** for
deployment status. This setup intentionally needs the first stable release before
either production or the shared preview becomes available.

## 8. Develop and release subsequent versions

Use feature branches and pull requests. After a validated merge to `main`, the
shared `/preview/` site updates. Production continues to use the latest published
stable release. PRs receive downloadable artifacts rather than individual live URLs.

When preparing a new version, update both npm manifests without creating a tag:

```sh
npm version 0.1.1 --no-git-tag-version
just npm-deps-hash
```

Copy the returned hash into `npmDepsHash` in `flake.nix`. The cache includes lockfile
metadata, so even a version-only lockfile change needs a matching hash. Run
`just format`, `just validate`, and `nix flake check`, then commit the version bump
with an SSH signature and merge it to `main`. Create `v0.1.1` with `git tag -s`, wait
for candidate CI, and publish the stable release as latest. Do not create a tag with
`npm version` before the version changes are committed and validated.

Use patch versions for compatible fixes, minor versions for compatible features,
and major versions for intentionally incompatible changes. Every production tag is
stable `vX.Y.Z`; prerelease tags are not accepted by the release-verification gate.

## 9. Inspect, recover, and maintain

After publication, verify:

```sh
curl -fsS https://ajolis.de/ > /dev/null
curl -fsS https://ajolis.de/preview/ > /dev/null
curl -fsS https://ajolis.de/build-info.json
curl -I https://www.ajolis.de/
```

The provenance document names the production tag/version/commit and preview commit.
The workflow summary records the same values. Combined archives include
`SHA256SUMS`; verify downloaded files with `sha256sum -c SHA256SUMS`. Actions
retention is finite and is not an archival guarantee. Published tags and pinned
lockfiles retain the source references needed for rebuilding while dependencies
remain available.

For a routine rollback, revert the relevant application change, increment the
version, validate, and publish a new signed patch release. Do not move an existing
tag. For an emergency rollback to an existing trusted stable release, mark that
release latest and manually run **Publish Pages** on `main`. Merely editing a
release's latest flag does not trigger this workflow. The current main preview
remains part of the combined deployment.

If a build or release verification fails, Pages keeps the previously deployed site.
If a deployment fails, inspect the Pages deployment status before retrying. Changes
to release-selection or assembly tooling are operational changes and should be
reviewed with the same care as production code, even when the production application
source remains pinned to a release.

Keep action commit pins and `flake.lock` updated through reviewed, signed changes.
Revalidate domain records if switching hosting providers. Local checks validate
workflow syntax, release gates, artifact composition, and both build variants;
GitHub permissions, DNS, TLS, and live deployment must be verified after setup.
