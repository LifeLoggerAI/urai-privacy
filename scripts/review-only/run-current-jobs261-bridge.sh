#!/usr/bin/env bash
# R554: disposable, review-only Privacy + Jobs #261 exact-commit acceptance.
# Never deploy, use real data, grant consent, or alter IAM. Not a release GO.
set -euo pipefail
umask 077

PRIVACY_REPO='https://github.com/LifeLoggerAI/urai-privacy.git'
JOBS_REPO='https://github.com/LifeLoggerAI/urai-jobs.git'
JOBS_SHA='b7a498e543160e64748a0679469a1fc1550acb3b'
JOBS_TREE='f655a6200ff12106de49faa678d54db707d21549'

case "${1:-}" in
  --plan)
    printf '%s\n' 'R554 REVIEW ONLY: exact Privacy commit required; exact Jobs #261 pinned.'
    printf '%s\n' 'Plan: credential preflight -> disposable pinned checkouts -> frozen installs -> Jobs shared-types/Functions builds -> Privacy Functions, typecheck, unit tests and Next build -> Java21 Auth+Firestore+Storage+Functions bridge -> private SHA256 receipt.'
    printf '%s\n' 'Unverified until actual full run. Genesis G0-G7 HOLD. No deploy, no positive C6, no real media, no IAM mutation.'
    exit 0
    ;;
  --execute-disposable) ;;
  *) printf '%s\n' 'DENIED: pass --plan or --execute-disposable' >&2; exit 2 ;;
esac

if [[ "${URAI_DISPOSABLE_REVIEW:-}" != 'YES_SYNTHETIC_ONLY' ]]; then
  echo 'DENIED: URAI_DISPOSABLE_REVIEW=YES_SYNTHETIC_ONLY required' >&2
  exit 2
fi
PRIVACY_SHA="${URAI_EXPECTED_PRIVACY_SHA:-}"
if [[ ! "$PRIVACY_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo 'DENIED: exact 40-hex URAI_EXPECTED_PRIVACY_SHA is required' >&2
  exit 2
fi

# Abort rather than silently use live-cloud credentials. Read-only public Git
# fetches and local Firebase emulators must work without provider credentials.
for key in GOOGLE_APPLICATION_CREDENTIALS FIREBASE_TOKEN GOOGLE_CLOUD_PROJECT GCLOUD_PROJECT CLOUDSDK_CORE_PROJECT GCLOUD_AUTH_CREDENTIAL_FILE_OVERRIDE GOOGLE_OAUTH_ACCESS_TOKEN; do
  if [[ -n "${!key:-}" ]]; then
    printf 'DENIED: forbidden cloud environment variable %s\n' "$key" >&2
    exit 2
  fi
done
unset GITHUB_TOKEN GH_TOKEN GOOGLE_APPLICATION_CREDENTIALS FIREBASE_TOKEN RUNPOD_API_KEY || true
export GIT_TERMINAL_PROMPT=0 CI=1 NEXT_TELEMETRY_DISABLED=1

if ! command -v timeout >/dev/null || ! command -v sha256sum >/dev/null || ! command -v git >/dev/null || ! command -v corepack >/dev/null || ! command -v java >/dev/null; then
  echo 'DENIED: timeout/sha256sum/git/corepack/java required' >&2
  exit 2
fi
node -e 'if(process.versions.node.split(".")[0]!=="22")process.exit(2)' || { echo 'DENIED: Node22 required' >&2; exit 2; }
java -version 2>&1 | grep -Eq 'version "21\.|openjdk 21\.' || { echo 'DENIED: Java21 required' >&2; exit 2; }

RUN_ROOT="$(mktemp -d /tmp/urai-r554-bridge-XXXXXX)"
EVIDENCE_ROOT="$(mktemp -d /tmp/urai-r554-evidence-XXXXXX)"
PRIVACY_DIR="$RUN_ROOT/privacy"
JOBS_DIR="$RUN_ROOT/jobs"
finalize() {
  rc=$?
  trap - EXIT
  if [[ -d "$EVIDENCE_ROOT" ]]; then
    printf 'R554_EXACT_PRIVACY_SHA=%s\nR554_EXACT_JOBS_SHA=%s\nR554_EXIT=%s\n' "$PRIVACY_SHA" "$JOBS_SHA" "$rc" > "$EVIDENCE_ROOT/RESULT.txt"
    (cd "$EVIDENCE_ROOT" && sha256sum ./*.log RESULT.txt > SHA256SUMS.txt) || true
    echo "R554_REVIEW_ONLY_EXIT=$rc EVIDENCE_DIR=$EVIDENCE_ROOT (PRIVATE; RETAIN APPROVED LOGS)"
  fi
  rm -rf -- "$RUN_ROOT"
  exit "$rc"
}
trap finalize EXIT

run_step() {
  local stage="$1"; shift
  echo "R554_STAGE_BEGIN=$stage"
  local rc=0
  # The checkout helper is a Bash function, not an executable path.
  if [[ "${1:-}" == fetch_exact ]]; then
    shift
    ( fetch_exact "$@" ) > "$EVIDENCE_ROOT/$stage.log" 2>&1 || rc=$?
  else
    timeout -k 10 900 "$@" > "$EVIDENCE_ROOT/$stage.log" 2>&1 || rc=$?
  fi
  echo "R554_STAGE=$stage EXIT=$rc SHA256=$(sha256sum "$EVIDENCE_ROOT/$stage.log" | cut -d' ' -f1)"
  if [[ "$rc" -ne 0 ]]; then
    echo "R554_DENIED: stage $stage failed (review private logs); no release authorization" >&2
    exit "$rc"
  fi
}

fetch_exact() {
  local repo="$1" dir="$2" sha="$3"
  local actual branch clean root
  # IMPORTANT: the caller evaluates ( fetch_exact ... ) in an OR-list to
  # capture its status. In Bash this disables implicit errexit inside the
  # function. Every Git operation must therefore return on failure explicitly.
  git init -q "$dir" || return $?
  git -C "$dir" remote add origin "$repo" || return $?
  timeout -k 10 180 git -C "$dir" -c credential.helper= fetch --quiet --no-tags --depth=1 origin "$sha" || return $?
  git -C "$dir" checkout --quiet --detach FETCH_HEAD || return $?
  actual="$(git -C "$dir" rev-parse --verify HEAD)" || return $?
  [[ "$actual" == "$sha" ]] || { echo 'DENIED: actual checkout commit mismatch' >&2; return 2; }
  branch="$(git -C "$dir" rev-parse --abbrev-ref HEAD)" || return $?
  [[ "$branch" == 'HEAD' ]] || { echo 'DENIED: checkout is not detached' >&2; return 2; }
  root="$(git -C "$dir" rev-parse --show-toplevel)" || return $?
  [[ "$root" == "$dir" ]] || { echo 'DENIED: unexpected Git repository root' >&2; return 2; }
  clean="$(git -C "$dir" status --porcelain=v1 --untracked-files=all)" || return $?
  [[ -z "$clean" ]] || { echo 'DENIED: checkout is not clean' >&2; return 2; }
}

run_step privacy_exact_fetch fetch_exact "$PRIVACY_REPO" "$PRIVACY_DIR" "$PRIVACY_SHA"
run_step jobs_exact_fetch fetch_exact "$JOBS_REPO" "$JOBS_DIR" "$JOBS_SHA"
if [[ "$(git -C "$JOBS_DIR" rev-parse 'HEAD^{tree}')" != "$JOBS_TREE" ]]; then
  echo 'DENIED: immutable Jobs #261 tree mismatch' >&2
  exit 2
fi

run_step jobs_pnpm_pin corepack prepare pnpm@8.15.9 --activate
run_step jobs_frozen_install corepack pnpm --dir "$JOBS_DIR" install --frozen-lockfile --ignore-scripts
run_step jobs_shared_types_build npm --prefix "$JOBS_DIR/packages/shared-types" run build
run_step jobs_functions_build npm --prefix "$JOBS_DIR/functions" run build
run_step privacy_root_frozen_install npm --prefix "$PRIVACY_DIR" ci --ignore-scripts
run_step privacy_functions_frozen_install npm --prefix "$PRIVACY_DIR/functions" ci --ignore-scripts
run_step privacy_functions_build npm --prefix "$PRIVACY_DIR/functions" run build
run_step privacy_typecheck npm --prefix "$PRIVACY_DIR" run typecheck
run_step privacy_unit npm --prefix "$PRIVACY_DIR" run test:unit
run_step privacy_next_build npm --prefix "$PRIVACY_DIR" run build

# The original source must still be pinned after frozen installs and builds.
# Next can rewrite this one generated tracked declaration file; revert only it.
if [[ "$(git -C "$PRIVACY_DIR" rev-parse HEAD)" != "$PRIVACY_SHA" ]]; then
  echo 'DENIED: Privacy checked-out HEAD moved during build' >&2
  exit 2
fi
privacy_status="$(git -C "$PRIVACY_DIR" status --porcelain=v1 --untracked-files=no)"
if [[ "$privacy_status" == ' M next-env.d.ts' ]]; then
  git -C "$PRIVACY_DIR" restore --source=HEAD --worktree -- next-env.d.ts
elif [[ -n "$privacy_status" ]]; then
  echo 'DENIED: unexpected tracked Privacy changes after build' >&2
  exit 2
fi
if [[ -n "$(git -C "$PRIVACY_DIR" status --porcelain=v1 --untracked-files=no)" ]] ||
   [[ -n "$(git -C "$JOBS_DIR" status --porcelain=v1 --untracked-files=no)" ]]; then
  echo 'DENIED: dirty tracked source after frozen builds' >&2
  exit 2
fi
# Bind observed compiled Jobs modules to the private execution receipt.
# These ignored generated JS modules are NOT covered by Git tree hashes.
for artifact in   functions/lib/functions/jobs/studioLifeMovieContract.js   functions/lib/functions/privacy/lifeMovieFirebaseOwnerState.js   functions/lib/functions/privacy/lifeMovieFirebaseSourceRightsAdapter.js   functions/lib/functions/privacy/lifeMovieDerivativeRevocation.js; do
  test -f "$JOBS_DIR/$artifact" || { echo 'DENIED: missing compiled Jobs module' >&2; exit 2; }
  sha256sum "$JOBS_DIR/$artifact" >> "$EVIDENCE_ROOT/COMPILED_JOBS_SHA256SUMS.txt"
done

# All four emulators are disposable; both Jobs and Privacy are on detached
# immutable commits. The fixture keeps C6 reviewOnlyEmulator=true and
# productionAuthorized=false and checks generation-bound deletion.
run_step actual_four_emulator_bridge env \
  URAI_JOBS_SOURCE_SHA="$JOBS_SHA" \
  URAI_JOBS_DIR="$JOBS_DIR" \
  npm --prefix "$PRIVACY_DIR" run test:life-movie:jobs-rights:bridge:emulated

# A zero exit is not enough: require the original fixture's explicit denied-
# production, four-service, 23+-check receipt. No synthetic result becomes GO.
node - "$EVIDENCE_ROOT/actual_four_emulator_bridge.log" <<'NODE'
const fs = require('node:fs');
const data = fs.readFileSync(process.argv[2], 'utf8');
const entry = data.split(/\r?\n/).find(x => x.startsWith('R454_REVIEW_ONLY_FIRESTORE_PASS '));
if (!entry) throw Error('R554: missing original emulator pass receipt');
const r = JSON.parse(entry.slice('R454_REVIEW_ONLY_FIRESTORE_PASS '.length));
if (!Number.isInteger(r.checksPassed) || r.checksPassed < 23 ||
    r.authEmulator !== true || r.firestoreEmulator !== true ||
    r.functionsEmulator !== true || r.jobSourceAuditReadFromRealAuthFirestoreStorage !== true ||
    r.productionAuthorized !== false || r.renderEnabled !== false ||
    r.approvedOwnerC6ConsentIssuer !== false || r.productionSignedJobsIdentityVerified !== false ||
    r.finalReleaseAccepted !== false) {
  throw Error('R554: incomplete, unsafe, or misclassified review-only bridge receipt');
}
console.log('R554_VERIFIED_REVIEW_RECEIPT_CHECKS=' + r.checksPassed + ' PRODUCTION_AUTHORIZED=false');
NODE

printf '%s\n' 'R554_SYNTHETIC_BRIDGE_PASSED: NOT production IAM, C6, Replay, or launch GO'
