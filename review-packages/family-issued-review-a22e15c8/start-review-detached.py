#!/usr/bin/env python3
"""Start only our bounded isolated review in a separate process session."""
from pathlib import Path
import json
import subprocess
import sys

root = Path(__file__).resolve().parent
custody = root / "custody"
custody.mkdir(exist_ok=True)
if (custody / "supervisor.pid").exists() or (custody / "issued-path-run.log").exists():
    raise SystemExit("Existing review evidence must not be overwritten; prepare a new directory.")
with (custody / "supervisor.log").open("xb") as output:
    child = subprocess.Popen([sys.executable, "-I", str(root / "run-family-issued-emulators.py")],
                             cwd=root, stdin=subprocess.DEVNULL, stdout=output,
                             stderr=subprocess.STDOUT, start_new_session=True)
(custody / "supervisor.pid").write_text(str(child.pid) + "\n")
print(json.dumps({"pid": child.pid, "started": True, "exitFile": str(custody / "issued-path-run.exit")}))
