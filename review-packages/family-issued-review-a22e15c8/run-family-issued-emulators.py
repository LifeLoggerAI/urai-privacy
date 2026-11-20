#!/usr/bin/env python3
"""Bounded synthetic-only native review; never deploys or changes real policy."""
import json
import os
from pathlib import Path
import signal
import socket
import subprocess
import time

ROOT = Path(__file__).resolve().parent
CUSTODY = ROOT / "custody"
PROJECT = "demo-urai-family-issued-review"
PORTS = (30099, 30080, 30199, 30001, 30150, 30440, 30450)
CUSTODY.mkdir(exist_ok=True)
env = {key: os.environ[key] for key in ("PATH", "HOME", "LANG", "TMPDIR") if key in os.environ}
env.update({
    "PATH": "/workspace/r1580-jre21/bin:" + env.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
    "XDG_CONFIG_HOME": str(CUSTODY / "empty-config"),
    "CLOUDSDK_CONFIG": str(CUSTODY / "empty-cloud-config"),
    "GCLOUD_PROJECT": PROJECT, "GOOGLE_CLOUD_PROJECT": PROJECT,
    "FIREBASE_AUTH_EMULATOR_HOST": "127.0.0.1:30099",
    "FIRESTORE_EMULATOR_HOST": "127.0.0.1:30080",
    "FIREBASE_STORAGE_EMULATOR_HOST": "127.0.0.1:30199",
    "STORAGE_EMULATOR_HOST": "http://127.0.0.1:30199",
    "FUNCTIONS_EMULATOR_HOST": "127.0.0.1:30001", "FUNCTIONS_EMULATOR": "true",
    "FIREBASE_CONFIG": json.dumps({"projectId": PROJECT, "storageBucket": PROJECT + ".appspot.com"}),
    "CI": "1", "FIREBASE_CLI_DISABLE_USAGE_REPORTING": "true",
    "FIREBASE_CLI_DISABLE_UPDATE_CHECK": "true", "CHOKIDAR_USEPOLLING": "true",
})
for name in ("empty-config", "empty-cloud-config"):
    (CUSTODY / name).mkdir(exist_ok=True)
steps = []

def run(name, argv, log, timeout=180):
    step = {"name": name, "startedAtEpochMs": int(time.time() * 1000), "exitCode": None}
    steps.append(step)
    log.write("\nREVIEW_STEP " + name + "\n")
    log.flush()
    child = subprocess.Popen(argv, cwd=ROOT, env=env, stdin=subprocess.DEVNULL,
                             stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    try:
        code = child.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(child.pid, signal.SIGTERM)
        try:
            child.wait(timeout=8)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait(timeout=8)
        step["timedOut"] = True
        raise RuntimeError("Bounded isolated subprocess timed out: " + name)
    finally:
        step["finishedAtEpochMs"] = int(time.time() * 1000)
        step["exitCode"] = child.returncode
        (CUSTODY / "steps.json").write_text(json.dumps(steps, indent=2) + "\n")
        log.flush()
    if code:
        raise subprocess.CalledProcessError(code, argv)

private_path = CUSTODY / "SYNTHETIC-EPHEMERAL-ONLY.pem"
public_path = CUSTODY / "synthetic-public-key.b64"
exit_code = 1
try:
    for port in PORTS:
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", port))
    with (CUSTODY / "issued-path-run.log").open("x") as log:
        for service in ("storytime", "privacy"):
            compiler = ROOT / service / "functions/node_modules/typescript/bin/tsc"
            if not compiler.exists():
                compiler = ROOT / service / "node_modules/typescript/bin/tsc"
            run(service + "-functions-build", ["node", str(compiler), "-p", str(ROOT / service / "functions/tsconfig.json")], log)
        run("default-off-canonical-denial", ["node", "tests/default-off.preflight.cjs"], log)
        run("ephemeral-test-key", ["node", "-e", "const c=require('node:crypto'),f=require('node:fs');const k=c.generateKeyPairSync('ed25519');f.writeFileSync(process.argv[1],k.privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600});f.writeFileSync(process.argv[2],k.publicKey.export({type:'spki',format:'der'}).toString('base64'));", str(private_path), str(public_path)], log)
        env.update({
            "STORYTIME_FAMILY_SHARING_ENABLED": "true",
            "FAMILY_ISSUED_REVIEW_ENABLED": "synthetic-only-v1",
            "FAMILY_ISSUED_REVIEW_POLICY": "synthetic-explicit-text-consent-v1",
            "FAMILY_ISSUED_REVIEW_PRIVATE_KEY_FILE": str(private_path),
            "STORYTIME_FAMILY_PRIVACY_ED25519_KEY_ID": "synthetic-family-issued-review-key",
            "STORYTIME_FAMILY_PRIVACY_ED25519_PUBLIC_KEY_SPKI_B64": public_path.read_text(),
        })
        run("native-issued-family-path", [
            "node", "/workspace/genesis/node_modules/firebase-tools/lib/bin/firebase.js",
            "emulators:exec", "--config", "firebase.issued-review.emulators.json",
            "--project", PROJECT, "--only", "auth,firestore,functions,storage",
            "node tests/family-issued-path.emulator.cjs",
        ], log, timeout=300)
        exit_code = 0
except Exception as error:
    with (CUSTODY / "supervisor-errors.log").open("a") as log:
        log.write(type(error).__name__ + ": " + str(error) + "\n")
finally:
    private_path.unlink(missing_ok=True)
    (CUSTODY / "issued-path-run.exit").write_text(str(exit_code) + "\n")
    summary = {"exitCode": exit_code, "project": PROJECT, "privateTestKeyRemoved": not private_path.exists(),
               "production": "HOLD_NO_GO", "privateMemoryWrites": "OFF", "canonicalPurposeRegistered": False}
    (CUSTODY / "supervisor-result.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary))
raise SystemExit(exit_code)
