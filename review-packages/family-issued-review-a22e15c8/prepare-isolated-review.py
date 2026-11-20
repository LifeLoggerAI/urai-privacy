#!/usr/bin/env python3
"""Archive pinned local Git objects and reuse byte-matched frozen dependencies.

No fetch, install, deployment, branch mutation or policy change. The output must
not exist. Only the two explicitly listed review modules overlay base runtime.
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile

PINS = {
    "storytime": ("cc0baee8a4b2bafc452b3e097b1f8770227d4cb7", "61ed8d6c784a5ca2d1733b19173b1709d403e6f0"),
    "privacy": ("8f79ade634a14fa31f8428e84b01f71cecec8d7e", "197eefb12a4fe2896df7c364a6018437317fe6b4"),
}
OVERLAYS = {
    "storytime": "functions/src/family-privacy-delivery-review.ts",
    "privacy": "functions/src/family-story-share-issued-review.ts",
}
HARNESS = (
    "CONTRACT.md", "run-family-issued-emulators.py", "start-review-detached.py",
    "firebase.issued-review.emulators.json", "fixture/functions/index.cjs",
    "fixture/functions/package.json", "tests/family-issued-path.emulator.cjs",
    "tests/default-off.preflight.cjs",
)
parser = argparse.ArgumentParser(description=__doc__)
for name in PINS:
    parser.add_argument("--" + name + "-source", required=True)
    parser.add_argument("--" + name + "-dependencies", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()
package = Path(__file__).resolve().parent
output = Path(args.output).resolve()
output.mkdir(mode=0o700, exist_ok=False)
custody = output / "custody"
custody.mkdir()
manifest = {"schemaVersion": "family-issued-review-source-v1", "services": {}, "harnessSha256": {}}

def git(repository, *argv, env=None, data=None):
    return subprocess.check_output(["git", "-C", str(repository), *argv], env=env, input=data)

for name, (commit, expected_tree) in PINS.items():
    repository = Path(getattr(args, name + "_source")).resolve()
    dependencies = Path(getattr(args, name + "_dependencies")).resolve()
    tree = git(repository, "rev-parse", commit + "^{tree}").decode().strip()
    if tree != expected_tree:
        raise RuntimeError("Pinned base tree mismatch: " + name)
    destination = output / name
    destination.mkdir()
    archive = git(repository, "archive", commit)
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:") as source:
        for member in source.getmembers():
            relative = PurePosixPath(member.name)
            if relative.is_absolute() or ".." in relative.parts:
                raise RuntimeError("Unsafe Git archive path")
            target = destination / member.name
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                target.parent.mkdir(parents=True, exist_ok=True)
                with source.extractfile(member) as handle:
                    target.write_bytes(handle.read())
                target.chmod(member.mode & 0o777)
            else:
                raise RuntimeError("Nonregular Git archive entry")
    lock_hashes = {}
    for sub in ("", "functions"):
        lock = destination / sub / "package-lock.json"
        prior_lock = dependencies / sub / "package-lock.json"
        modules = dependencies / sub / "node_modules"
        if not modules.is_dir() or lock.read_bytes() != prior_lock.read_bytes():
            raise RuntimeError("Frozen dependency custody mismatch: " + name + "/" + sub)
        (destination / sub / "node_modules").symlink_to(modules, target_is_directory=True)
        lock_hashes[sub or "root"] = hashlib.sha256(lock.read_bytes()).hexdigest()
    relative = OVERLAYS[name]
    target = destination / relative
    if target.exists():
        raise RuntimeError("Review-only module unexpectedly exists in base")
    shutil.copyfile(package / name / relative, target)
    content = target.read_bytes()
    object_root = custody / (name + "-git-objects")
    (object_root / "info").mkdir(parents=True)
    (object_root / "pack").mkdir()
    base_objects = git(repository, "rev-parse", "--path-format=absolute", "--git-path", "objects").decode().strip()
    git_env = dict(os.environ)
    git_env.update({"GIT_OBJECT_DIRECTORY": str(object_root),
                    "GIT_ALTERNATE_OBJECT_DIRECTORIES": base_objects,
                    "GIT_INDEX_FILE": str(custody / (name + "-review.index"))})
    git(repository, "read-tree", commit, env=git_env)
    blob = git(repository, "hash-object", "-w", "--stdin", env=git_env, data=content).decode().strip()
    git(repository, "update-index", "--add", "--cacheinfo", "100644," + blob + "," + relative, env=git_env)
    proposed_tree = git(repository, "write-tree", env=git_env).decode().strip()
    manifest["services"][name] = {
        "baseCommit": commit, "baseTree": tree, "proposedTree": proposed_tree,
        "overlayPath": relative, "overlayBlob": blob,
        "overlaySha256": hashlib.sha256(content).hexdigest(),
        "lockSha256": lock_hashes, "ordinaryEntrypointsChanged": False,
    }
for relative in HARNESS:
    target = output / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(package / relative, target)
    manifest["harnessSha256"][relative] = hashlib.sha256(target.read_bytes()).hexdigest()
(output / "fixture/functions/node_modules").symlink_to(output / "storytime/functions/node_modules", target_is_directory=True)
(custody / "source-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(json.dumps({"prepared": str(output), "sourceManifest": manifest, "executed": False,
                  "production": "HOLD_NO_GO", "privateMemoryWrites": "OFF"}))
