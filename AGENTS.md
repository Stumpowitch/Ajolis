# Repository instructions

These rules apply to every contributor and coding agent working in this repository.
Tool-specific instruction files are entry points to this document; keep the rules
centralized here. Read this file before editing and inspect the working tree first.

## Project scope and structure

- Build a small, static Astro website with TypeScript in strict mode.
- Keep routes in `src/pages`, document layouts in `src/layouts`, reusable UI in
  `src/components`, shared CSS in `src/styles`, and unchanged public assets in
  `public`. Create additional directories only when they contain useful code.
- Prefer semantic HTML, accessible navigation, responsive CSS, and Astro components.
  Add client-side JavaScript, frameworks, integrations, or dependencies only for a
  concrete requirement. Do not add speculative abstractions or placeholder services.
- Keep development tools in `flake.nix` and JavaScript dependencies in `package.json`.
  Commit both lockfiles. Use npm exclusively for JavaScript dependencies.

## Working procedure

- Preserve existing user changes. Never overwrite unrelated work, rewrite history,
  force-push, or discard files without explicit authorization.
- Implement a coherent change, validate it, and commit it immediately before moving
  to the next independent change. Do not combine unrelated changes into one commit.
- Inspect the staged diff and run `git diff --check` before each commit.
- Use concise English Conventional Commit subjects, for example
  `feat(site): add the home page`. Add an informative body describing behavior,
  relevant design decisions, and validation when the change needs explanation.
- Every commit must be SSH-signed using the authorized TPM-backed key. On the
  development laptop, configure `user.signingkey` to `~/.ssh/id_ecdsa.pub` and use
  the running `ssh-tpm-agent`. Keep machine-specific configuration in `.git/config`.
  Never copy private keys or TPM key files into the repository.
- Verify signatures with `git verify-commit HEAD`. If signing is unavailable,
  report the blocker and retain the changes; never silently disable signing or
  substitute another key or identity.
- Do not add AI attribution, generated-by notices, watermarks, promotional text,
  assistant signatures, or AI `Co-authored-by` trailers to code, documentation,
  commits, or pull requests. Preserve required third-party license notices.
- Keep all documentation, code comments, identifiers, commit messages, and technical
  metadata in English. Use neutral, technically informative language. Do not include
  personal remarks, conversation transcripts, jokes, or commentary about assistants.
- Do not publish, deploy, push, or contact external services on behalf of the project
  unless the task authorizes that action. Installing required dependencies is part
  of the local development workflow.

## Validation and maintenance

- Enter the pinned environment with `direnv allow` / `direnv exec .` or `nix develop`.
  Do not depend on globally installed Node.js or JavaScript tools.
- Use the repository's documented commands. Run checks relevant to each change;
  validate application changes with formatting, linting, type checks, and a build.
- Add behavioral tests when meaningful logic is introduced. Do not add tests that
  merely duplicate markup, configuration, or implementation details.
- Validate Nix changes with the formatter and `nix flake check`. Keep the Nix npm
  dependency hash synchronized with `package-lock.json` when a package is defined.
- Update technical documentation alongside behavior, commands, or configuration.
  State verification limits accurately; never claim checks that were not run.
- Keep secrets, environment overrides, build outputs, dependency directories, and
  editor-local state untracked. Review new dependencies and lockfile changes.
