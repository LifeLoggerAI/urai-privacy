{ pkgs, ... }:

{
  packages = [
    pkgs.nodejs_22
    pkgs.firebase-tools
    pkgs.jdk21
  ];
}
