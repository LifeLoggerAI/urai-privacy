#!/usr/bin/env bash
# R835 review only. Exact Jobs #320 atomic status -> Privacy callable; demo-only.
set -Eeuo pipefail
umask 077
die() { echo "URAI_R818_HOLD: $*" >&2; exit 1; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PROJECT=demo-urai-privacy-integration-test
JOBS_SHA=ea8f0165ac74511a4e4196919ddd3109d0c1ff2e
EXPECTED="${URAI_EXPECTED_PRIVACY_SHA:-}"
JOBS_DIR="${URAI_JOBS_SOURCE_DIR:-}"
[[ "$EXPECTED" =~ ^[0-9a-f]{40}$ ]] || die "Pinned Privacy SHA required"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || die "Privacy HEAD mismatch"
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die "Privacy dirty"
[[ "$JOBS_DIR" == /tmp/* && -d "$JOBS_DIR/.git" ]] || die "Disposable Jobs checkout required"
[[ "$(git -C "$JOBS_DIR" rev-parse HEAD)" == "$JOBS_SHA" ]] || die "Jobs SHA mismatch"
[[ -z "$(git -C "$JOBS_DIR" status --porcelain --untracked-files=all)" ]] || die "Jobs dirty"
[[ "$(node -v)" == v22.* ]] || die "Node 22 required"
[[ "$(pnpm -v)" == 8.15.9 ]] || die "pnpm 8.15.9 required"
command -v java >/dev/null || die "Java required"
for name in GOOGLE_APPLICATION_CREDENTIALS FIREBASE_TOKEN FIREBASE_CLI_TOKEN GOOGLE_OAUTH_ACCESS_TOKEN GOOGLE_CLOUD_ACCESS_TOKEN GITHUB_TOKEN GH_TOKEN RUNPOD_API_KEY FIREBASE_CONFIG GCS_BUCKET_NAME FIREBASE_STORAGE_BUCKET GOOGLE_CLOUD_STORAGE_BUCKET; do
  [[ -z "${!name:-}" ]] || die "Credential or bucket selection present: $name"
done
for name in GCLOUD_PROJECT GOOGLE_CLOUD_PROJECT CLOUDSDK_CORE_PROJECT FIREBASE_PROJECT_ID; do
  [[ -z "${!name:-}" || "${!name}" == "$PROJECT" ]] || die "Non-disposable project: $name"
done
for name in FIREBASE_AUTH_EMULATOR_HOST FIRESTORE_EMULATOR_HOST FIREBASE_FUNCTIONS_EMULATOR_HOST FIREBASE_STORAGE_EMULATOR_HOST FUNCTIONS_EMULATOR_HOST; do
  [[ -z "${!name:-}" ]] || die "Preexisting emulator override: $name"
done
echo "URAI_R835_SOURCE_PINS privacy=$EXPECTED jobs=$JOBS_SHA"
# Preserve original full-source and native test commands. Bound each stage to
# prevent a stalled install/emulator from consuming compute indefinitely.
# Stage SHA256 receipts stay in stdout even if disposable runner files vanish.
for tool in timeout sha256sum mktemp tail; do
  command -v "$tool" >/dev/null || die "Missing native acceptance tool: $tool"
done
OUT="$(mktemp -d /tmp/urai-privacy-native.XXXXXX)"
printf 'stage\tstatus\texit\tlog_sha256\n' > "$OUT/stages.tsv"
run_stage() {
  local name="$1" limit="$2" code=0 hash
  shift 2
  timeout -k 30s "$limit" "$@" > "$OUT/$name.log" 2>&1 || code=$?
  hash="$(sha256sum "$OUT/$name.log" | cut -d' ' -f1)"
  if (( code )); then
    printf '%s\tFAIL\t%s\t%s\n' "$name" "$code" "$hash" >> "$OUT/stages.tsv"
    printf 'URAI_PRIVACY_NATIVE_STAGE_FAIL stage=%s exit=%s sha256=%s\n' "$name" "$code" "$hash" >&2
    tail -n 60 "$OUT/$name.log" >&2 || true
    die "Native stage $name failed; production HOLD; full log $OUT/$name.log"
  fi
  printf '%s\tPASS\t0\t%s\n' "$name" "$hash" >> "$OUT/stages.tsv"
  printf 'URAI_PRIVACY_NATIVE_STAGE_PASS stage=%s sha256=%s\n' "$name" "$hash"
}
run_stage static_source_pin 60s node --test tests/integration/r823-demo-project-source-pin.static.test.mjs
run_stage privacy_frozen_install 900s npm ci --no-audit --no-fund
run_stage privacy_functions_frozen_install 900s npm ci --prefix functions --no-audit --no-fund
run_stage privacy_typecheck 600s npm run typecheck --prefix functions
run_stage privacy_build 600s npm run build --prefix functions
# Explicit Jobs working directory; original frozen install and original builds.
run_stage jobs_frozen_install 900s bash -c 'cd "$1" && shift && exec "$@"' bash "$JOBS_DIR" pnpm install --frozen-lockfile
# Run the actual original Jobs owner/tenant + transactional long-form tests,
# then its ENTIRE workspace typecheck/build, before starting Privacy emulators.
# This prevents a native cross-repository pass from certifying a source head
# whose transactional consent/child status regressions were never executed.
run_stage jobs_owner_status_contract 300s bash -c 'cd "$1" && shift && exec "$@"' bash "$JOBS_DIR" node --test scripts/life-movies-owner-tenant-transaction.test.mjs
run_stage jobs_full_typecheck 900s bash -c 'cd "$1" && shift && exec "$@"' bash "$JOBS_DIR" pnpm typecheck
run_stage jobs_full_build 900s bash -c 'cd "$1" && shift && exec "$@"' bash "$JOBS_DIR" pnpm build
[[ -f "$JOBS_DIR/functions/lib/functions/privacy/lifeMovieJobsPrivacyClient.js" ]] || die "Jobs compiled bridge missing"
export URAI_EMULATOR_PROJECT="$PROJECT" URAI_PRIVACY_JOBS_VERIFIER_UID=synthetic-jobs-verifier-uid
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
run_stage privacy_four_emulators 900s npx --no-install firebase --project "$PROJECT" emulators:exec \
  --config firebase.emulators.json --only auth,firestore,functions,storage \
  'node tests/integration/life-movie-jobs-native-transport.emulator.mjs && node tests/integration/life-movie-review-issuer-firestore.emulator.mjs'
printf 'URAI_R835_NATIVE_JOBS_PRIVACY_NEGATIVE_AND_REVIEW_ONLY_ISSUER_PASS privacy=%s jobs=%s productionGrant=false render=false\n' "$EXPECTED" "$JOBS_SHA"
printf 'URAI_PRIVACY_NATIVE_STAGE_REPORT %s\n' "$OUT/stages.tsv"
