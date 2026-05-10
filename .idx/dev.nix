{ pkgs, ... }:
let
  pythonCommand = pkgs.writeShellScriptBin "python" ''
    exec ${pkgs.python311}/bin/python3 "$@"
  '';
in {
  channel = "stable-24.05";

  packages = [
    pkgs.nodejs_20
    pkgs.python311
    pkgs.python311Packages.pip
    pythonCommand
    pkgs.firebase-tools
    pkgs.git
  ];

  idx = {
    extensions = [
      "dbaeumer.vscode-eslint"
      "esbenp.prettier-vscode"
      "ms-python.python"
    ];

    workspace = {
      onCreate = {
        install-node-deps = "npm install";
        install-python-deps = "python -m pip install -r requirements.txt";
      };
    };
  };
}
