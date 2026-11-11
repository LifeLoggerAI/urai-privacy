#!/usr/bin/env bash
# R30 review only. Current Jobs R932 candidate -> current Privacy R27/R29 callable.
set -Eeuo pipefail
umask 077
die() { echo "URAI_R30_HOLD: $*" >&2; exit 1; }
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PROJECT=urai-privacy-integration-test
JOBS_SHA=12fac12fbbbedb7601d126c003813607b1774858
EXPECTED="${URAI_EXPECTED_PRIVACY_SHA:-}"
JOBS_DIR="${URAI_JOBS_SOURCE_DIR:-}"
[[ "$EXPECTED" =~ ^[0-9a-f]{40}$ ]] || die "Pinned Privacy SHA required"
[[ "$(git rev-parse HEAD)" == "$EXPECTED" ]] || die "Privacy HEAD mismatch"
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || die "Privacy dirty"
[[ -f tests/integration/life-movie-jobs-r932-native-transport.emulator.mjs ]] || die "Pinned R932 native transport harness missing"
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
echo "URAI_R30_SOURCE_PINS privacy=$EXPECTED jobs=$JOBS_SHA"
npm ci --no-audit --no-fund
npm ci --prefix functions --no-audit --no-fund
npm run typecheck --prefix functions
npm run build --prefix functions
(
  cd "$JOBS_DIR"
  pnpm install --frozen-lockfile
  pnpm --filter @urai-jobs/shared-types build
  pnpm --filter urai-jobs-functions build
)
[[ -f "$JOBS_DIR/functions/lib/functions/privacy/lifeMovieJobsPrivacyClient.js" ]] || die "Jobs compiled bridge missing"
export URAI_EMULATOR_PROJECT="$PROJECT" URAI_PRIVACY_JOBS_VERIFIER_UID=synthetic-jobs-verifier-uid
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_FUNCTIONS_EMULATOR_HOST=127.0.0.1:5001 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199
npx --no-install firebase --project "$PROJECT" emulators:exec \
  --config firebase.emulators.json --only auth,firestore,functions,storage \
  'node tests/integration/life-movie-jobs-r932-native-transport.emulator.mjs'
printf 'URAI_R30_NATIVE_JOBS_PRIVACY_BOUNDARY_PASS privacy=%s jobs=%s positiveGrant=false render=false\n' "$EXPECTED" "$JOBS_SHA"
