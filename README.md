# Ajolis

A static Astro website with a Nix-based development environment.

Repository-wide development and commit rules are defined in [AGENTS.md](AGENTS.md).
Documentation, source comments, and commit messages use technical English.

## Development environment

Install Nix with the `nix-command` and `flakes` experimental features enabled,
and install direnv with its shell hook. The flake pins the toolchain through
`flake.lock` and provides Node.js 24 with npm, Just, Git, OpenSSH, Nix formatting
and analysis tools, shell analysis tools, and common command-line utilities.

```sh
direnv allow
direnv exec . just
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
