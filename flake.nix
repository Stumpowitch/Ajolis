{
  description = "Ajolis static website and development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      pkgsFor = system: import nixpkgs { inherit system; };
    in
    {
      devShells = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          default = pkgs.mkShellNoCC {
            packages = with pkgs; [
              nodejs_24
              just
              git
              openssh
              direnv
              nix-direnv
              nixfmt
              nil
              statix
              deadnix
              shellcheck
              shfmt
              ripgrep
              jq
              curl
              prefetch-npm-deps
              actionlint
            ];

            ASTRO_TELEMETRY_DISABLED = "1";
            NPM_CONFIG_FUND = "false";
          };
        }
      );

      formatter = forAllSystems (system: (pkgsFor system).nixfmt);

      packages = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
          mkWebsite =
            target:
            (pkgs.buildNpmPackage.override { nodejs = pkgs.nodejs_24; }) {
              pname = "ajolis";
              inherit (builtins.fromJSON (builtins.readFile ./package.json)) version;
              src = pkgs.lib.fileset.toSource {
                root = ./.;
                fileset = pkgs.lib.fileset.unions [
                  ./src
                  ./public
                  ./package.json
                  ./package-lock.json
                  ./astro.config.mjs
                  ./tsconfig.json
                  ./eslint.config.mjs
                ];
              };
              npmDepsHash = "sha256-RxtxBtb7N/jIBxe7vDlEbKAQ7lw/wSZ6j/iUNX73tqQ=";
              ASTRO_TELEMETRY_DISABLED = "1";
              DEPLOY_TARGET = target;
              doCheck = true;
              checkPhase = ''
                runHook preCheck
                npm run lint
                npm run check
                runHook postCheck
              '';
              installPhase = ''
                runHook preInstall
                mkdir -p "$out"
                cp -r dist/. "$out/"
                runHook postInstall
              '';
            };
        in
        {
          default = mkWebsite "production";
          preview = mkWebsite "preview";
        }
      );

      checks = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          website = self.packages.${system}.default;
          preview = self.packages.${system}.preview;
          nix-quality =
            pkgs.runCommand "ajolis-nix-quality"
              {
                nativeBuildInputs = with pkgs; [
                  nixfmt
                  statix
                  deadnix
                ];
              }
              ''
                cp ${./flake.nix} flake.nix
                nixfmt --check flake.nix
                statix check .
                deadnix --fail .
                touch "$out"
              '';
        }
      );
    };
}
