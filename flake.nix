{
  description = "Ajolis static website and development environment";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
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
            ];

            ASTRO_TELEMETRY_DISABLED = "1";
            NPM_CONFIG_FUND = "false";
          };
        }
      );

      formatter = forAllSystems (system: (pkgsFor system).nixfmt);

      checks = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
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
