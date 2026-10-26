set dotenv-load := false

# List available development commands.
default:
    @just --list

# Validate formatting and static analysis of Nix sources.
check-nix:
    nixfmt --check flake.nix
    statix check .
    deadnix --fail .

# Evaluate the flake and run its checks on the current system.
flake-check:
    nix flake check
