# Ajolis

A static Astro website with a Nix-based development environment.

The initial site includes a responsive home page, a shared document layout, an
accessible header, and a custom 404 page. It produces static HTML and CSS without
a client-side framework, external fonts, or runtime services.

Repository-wide development and commit rules are defined in [AGENTS.md](AGENTS.md).
Documentation, source comments, and commit messages use technical English.

## Development environment

Install Nix with the `nix-command` and `flakes` experimental features enabled,
and install direnv with its shell hook. The flake pins the toolchain through
`flake.lock` and provides Node.js 24 with npm, Just, Git, OpenSSH, Nix formatting
and analysis tools, shell analysis tools, and common command-line utilities.

```sh
direnv allow
direnv exec . just install
direnv exec . just dev
```

Alternatively, run `nix develop` and execute project commands in that shell.
No global Node.js installation is required. The environment supports Linux and
macOS on x86-64 and ARM64; only the current development system is validated locally.
Nix itself and a working SSH agent are host prerequisites.

The `.envrc` loads the flake without installing JavaScript dependencies or changing
Git configuration. Host-level nix-direnv integration enables caching; plain direnv
also works. When nix-direnv is available, failed environments do not silently fall
back to an older cached toolchain.

```sh
just check-nix
just flake-check
```

## Signed commits

The development laptop uses `ssh-tpm-agent` with `~/.ssh/id_ecdsa.tpm` and its public
key `~/.ssh/id_ecdsa.pub`. Configure signing locally for each checkout:

```sh
ssh-tpm-add ~/.ssh/id_ecdsa.tpm
git config --local gpg.format ssh
git config --local user.signingkey ~/.ssh/id_ecdsa.pub
git config --local commit.gpgsign true
git config --local tag.gpgsign true
```

Signature verification additionally requires an SSH allowed-signers file associating
the trusted public key with the commit identity. This checkout uses a local file in
`.git/allowed_signers`, selected through `gpg.ssh.allowedSignersFile`. Public-key trust
and private-key access are separate: the public key selects the agent identity;
the TPM-backed agent performs signing. Verify each commit with `git verify-commit HEAD`.
Machine-specific Git settings and signing material are never versioned.

## Commands

Run these inside `nix develop`, a direnv-enabled terminal, or through
`direnv exec . just <command>`.

| Command              | Purpose                                                    |
| -------------------- | ---------------------------------------------------------- |
| `just`               | List available commands                                    |
| `just install`       | Install dependencies with `npm ci`                         |
| `just dev`           | Start the development server at `http://127.0.0.1:4321`    |
| `just build`         | Generate static output in `dist/`                          |
| `just preview`       | Build and serve production output on port 4321             |
| `just check`         | Check Astro templates and strict TypeScript                |
| `just lint`          | Run ESLint, including Astro accessibility rules            |
| `just format`        | Format web sources, documentation, Nix, and `.envrc`       |
| `just format-check`  | Check formatting without writing files                     |
| `just check-nix`     | Check Nix formatting and static analysis                   |
| `just check-shell`   | Check `.envrc` with ShellCheck and shfmt                   |
| `just validate`      | Run local quality gates and build the site                 |
| `just flake-check`   | Evaluate and check the flake on the current system         |
| `just build-nix`     | Build the static website in the Nix sandbox into `result/` |
| `just npm-deps-hash` | Compute the Nix npm dependency hash from the lockfile      |

Stop the development server before starting the production preview: both use the
same fixed port, and an occupied port produces an error. The preview server is a
local inspection tool, not a production hosting service. Use `just stop` to stop
servers registered for this checkout. In an interactive terminal, Ctrl+C also
stops the foreground server. Astro may start a background server in automated
sessions; `just stop` handles those registered processes as well.

JavaScript commands are also available as npm scripts. `npm run validate` checks
web formatting, lint, types, and the production build. `just validate` additionally
checks Nix, shell configuration, and CI workflows. `npm test` exercises release
signature/version/ancestry checks and production/preview artifact isolation.

## Project structure

```text
public/                  Assets copied unchanged to the build output
src/
  components/            Reusable Astro UI components
  layouts/               Shared HTML document structure and metadata
  pages/                 File-based routes, including 404.astro
  styles/                Global CSS and design tokens
astro.config.mjs         Static output and local server configuration
eslint.config.mjs        JavaScript, TypeScript, and Astro lint rules
flake.nix / flake.lock   Pinned system toolchain and Nix checks
justfile                Shared development commands
package*.json           JavaScript package metadata and dependency lockfile
tsconfig.json           Astro strictest TypeScript settings and @/ imports
```

Keep route files focused on page composition. Components own local styles;
`global.css` contains shared defaults and tokens. Add `src/assets` when assets need
Astro processing and content collections when structured content is introduced.
Do not create empty architectural layers in advance.

Production builds use `https://ajolis.de` for canonical URLs. `just build-preview`
or `nix build .#preview` builds for `https://ajolis.de/preview/` and marks every page
`noindex, nofollow`. The 404 page is always excluded from indexing. Preview pages
are public; indexing directives are not access controls. Links and assets respect
the build's base path. GitHub Pages uses the production `404.html` for missing
routes, including missing preview routes.

## Dependency maintenance

Direct JavaScript dependencies use exact versions and `package-lock.json` records
the full tree. Use `npm install <package>@<version>` for intentional changes, then
run validation and commit the manifest and lockfile together. `npm audit` reports
known advisories; review suggested updates before applying them.

Update the system toolchain with `nix flake update`, reload direnv, and validate the
result. Node.js is pinned by the flake; `package.json` constrains compatible Node.js
and npm majors. The first environment load and dependency install require network
access. There are no required application secrets or environment variables.

`nix build` uses the same Node.js toolchain and npm lockfile in an isolated build.
It also runs ESLint and Astro's type checks. The resulting `result/` symlink points
to static files in the Nix store. `nix flake check` includes that build alongside
Nix formatting and static analysis. It does not replace repository-wide formatting
or shell checks; use `just validate` for those.

After changing `package-lock.json`, run `just npm-deps-hash`, update `npmDepsHash` in
`flake.nix` with the returned SHA-256 value, and verify `nix build`. Stage newly
created source files before invoking flake commands because Git-backed flakes
exclude untracked files. Commit dependency metadata and the Nix hash together.

## Continuous integration

`.github/workflows/ci.yml` validates pull requests, `main`, and `v*` tags and retains
candidate builds. Tag builds additionally verify SSH signatures and release
versions using the `RELEASE_SIGNERS` repository variable.

`.github/workflows/pages.yml` publishes one combined artifact: the latest published
stable release at `/` and the current validated `main` at `/preview/`. It runs after
successful main-branch CI, on stable release publication, or on manual dispatch.
It verifies the release before building its exact commit, reruns validation on
the main source, records both commits in `/build-info.json`, and retains a combined
archive with its SHA-256 checksum. A first stable release is required before any
deployment. Publishing a release and marking it latest is the production approval.

Only the deployment job receives Pages and OIDC write permissions. Deployment is
serialized, stale main CI completions are skipped, and PR artifacts are never
consumed by the publishing workflow. Actions are pinned to commit IDs and checkout
credentials are not persisted. No workflow pushes Git commits or creates tags.

Run `just check-ci` to validate workflow syntax and embedded shell commands with
actionlint. A hosted CI run requires pushing the repository to GitHub; validation
can run locally without a remote. For local release verification, provide a trusted
allowed-signers entry in `RELEASE_SIGNERS` and run
`node scripts/verify-release.mjs v0.1.0` after fetching `origin/main` and tags.

## VS Code workspace

Open `ajolis.code-workspace` and install the workspace's recommended extensions
using **Extensions: Show Recommended Extensions**. Trust the checkout and allow
`.envrc` when prompted. Launching VS Code from the development environment also
ensures language servers inherit the pinned tools:

```sh
direnv exec . code ajolis.code-workspace
```

VS Code is a host application and is not installed by the flake. The recommendations
include Astro, Prettier, ESLint, Nix IDE, direnv, EditorConfig, Just syntax support,
ShellCheck, YAML support, and
[Tasks (`actboy168.tasks`)](https://marketplace.visualstudio.com/items?itemName=actboy168.tasks).

The Tasks extension displays **Install**, **Dev**, **Build**, **Preview**,
**Validate**, **Format**, and **Stop** buttons in the status bar. Additional commands
are available through **Tasks: Run Task**. Ctrl+Shift+B runs the default build task;
**Tasks: Run Test Task** runs the full validation task. All tasks explicitly invoke
`direnv exec` and the same Just recipes used in the terminal. The extension is a
convenience; VS Code's built-in task runner works independently.

Formatting on save uses the project's Prettier configuration for web sources and
documentation and `nil` with `nixfmt` for Nix. Use **Format** for shell formatting.
The workspace uses the local TypeScript SDK and enables signed Git commits.

Optional F5 configurations launch Chrome or Edge after the development task is
ready. They require the selected browser to be installed on the host. Stopping a
browser debugging session leaves the development task available; use **Stop** or
**Tasks: Terminate Task** to shut down the server. If a language server cannot find
its executable, reload the window after direnv loads or launch VS Code with the
command above.

## Contributor instruction discovery

`AGENTS.md` is the authoritative instruction file for tools that support it,
including Codex and compatible agents. Entry points are provided for Claude Code,
Gemini CLI, GitHub Copilot, Cursor, Windsurf, Cline, Roo Code, and Aider. Aider's
automatic commits are disabled so commits can be reviewed and signed explicitly.
Tools that do not discover repository instructions must be given `AGENTS.md`
explicitly. The entry points reference the same policy instead of duplicating it.

The package is private and marked `UNLICENSED`; no distribution license is granted
by this repository metadata.
