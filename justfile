set dotenv-load := false

# List available development commands.
default:
    @just --list

# Install the exact JavaScript dependency tree from the lockfile.
install:
    npm ci

# Start the local development server on port 4321.
dev:
    npm run dev

# Build the static website into dist/.
build:
    npm run build

# Build and serve the production output locally.
preview: build
    npm run preview

# Check Astro templates and TypeScript.
check:
    npm run check

# Lint JavaScript, TypeScript, and Astro accessibility rules.
lint:
    npm run lint

# Format source, documentation, Nix, and shell configuration.
format:
    npm run format
    nixfmt flake.nix
    shfmt -w -i 2 .envrc

# Check all repository formatting without changing files.
format-check:
    npm run format:check
    nixfmt --check flake.nix
    shfmt -d -i 2 .envrc

# Check the direnv script as Bash with external direnv functions.
check-shell:
    shellcheck --shell=bash .envrc
    shfmt -d -i 2 .envrc

# Run all local quality gates and build the static site.
validate: check-nix check-shell check-ci
    npm run validate

# Validate formatting and static analysis of Nix sources.
check-nix:
    nixfmt --check flake.nix
    statix check .
    deadnix --fail .

# Evaluate the flake and run its checks on the current system.
flake-check:
    nix flake check

# Build the website in the Nix sandbox; result/ contains the static output.
build-nix:
    nix build

# Compute the npm dependency hash after changing package-lock.json.
npm-deps-hash:
    prefetch-npm-deps package-lock.json

# Validate GitHub Actions workflow syntax and embedded shell commands.
check-ci:
    actionlint
