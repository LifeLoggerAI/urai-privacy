{ pkgs, ... }:

{
  packages = [
    pkgs.nodejs_20
    pkgs.firebase-tools
    pkgs.jdk21
  ];
}
