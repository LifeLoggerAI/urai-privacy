#!/usr/bin/env bash
# ONE URAI R580: reproducibility-only frozen Jobs264 CPU build.
set -Eeuo pipefail
umask 077
export CI=1 GIT_TERMINAL_PROMPT=0 NEXT_TELEMETRY_DISABLED=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0
unset GITHUB_TOKEN GH_TOKEN RUNPOD_API_KEY GOOGLE_APPLICATION_CREDENTIALS GOOGLE_CLOUD_PROJECT GCLOUD_PROJECT FIREBASE_TOKEN STRIPE_SECRET_KEY OPENAI_API_KEY GOOGLE_OAUTH_ACCESS_TOKEN AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY || true
PRIVACY_SHA="$1"
JOBS_SHA='e2a700bd186c4dcff47c6da763e647992145d8b0'
[[ "$PRIVACY_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo R580_DENY_PRIVACY_SHA;exit 64; }
ROOT="$(mktemp -d /tmp/urai-r580-XXXXXX)"
STAGE=checkout
on_exit(){
 rc="$?";trap - EXIT
 echo "R580_FINISHED=$(date -u +%FT%TZ)"
 echo "R580_FINAL_EXIT=$rc"
 echo "R580_FINAL_STAGE=$STAGE"
 for n in tests guard install shared functions manifest;do
  if [[ -f "$ROOT/$n.log" ]];then
   echo "R580_STAGE_LOG_SHA256_$n=$(sha256sum "$ROOT/$n.log" | cut -d' ' -f1)"
   if [[ "$STAGE" == "$n" && "$rc" -ne 0 ]];then echo R580_FAILED_TAIL_BEGIN;tail -n 45 "$ROOT/$n.log";echo R580_FAILED_TAIL_END;fi
  fi
 done
 echo R580_PRODUCTION_AUTHORIZED=false
 echo R580_GENESIS=HOLD
 sleep 120
 exit "$rc"
}
trap on_exit EXIT
step(){
 STAGE="$1";secs="$2";shift 2
 echo "R580_STAGE_$STAGE=START"
 if timeout -k 10 "$secs" "$@" >"$ROOT/$STAGE.log" 2>&1;then echo "R580_STAGE_$STAGE=PASS";else echo "R580_STAGE_$STAGE=FAIL";return 32;fi
}
echo "R580_STARTED=$(date -u +%FT%TZ)"
echo "R580_RUN_ID=$R580_RUN_ID"
echo "R580_NODE=$(node -v)"
corepack enable >/dev/null
corepack prepare pnpm@8.15.9 --activate >/dev/null 2>&1
echo "R580_PNPM=$(pnpm -v)"
mkdir "$ROOT/privacy" "$ROOT/jobs"
git -C "$ROOT/privacy" init -q
git -C "$ROOT/privacy" remote add origin https://github.com/LifeLoggerAI/urai-privacy.git
timeout -k 10 120 git -C "$ROOT/privacy" fetch -q --no-tags --depth 1 origin "$PRIVACY_SHA"
git -C "$ROOT/privacy" checkout -q --detach FETCH_HEAD
[[ "$(git -C "$ROOT/privacy" rev-parse HEAD)" == "$PRIVACY_SHA" ]]
git -C "$ROOT/jobs" init -q
git -C "$ROOT/jobs" remote add origin https://github.com/LifeLoggerAI/urai-jobs.git
timeout -k 10 120 git -C "$ROOT/jobs" fetch -q --no-tags --depth 1 origin "$JOBS_SHA"
git -C "$ROOT/jobs" checkout -q --detach FETCH_HEAD
[[ "$(git -C "$ROOT/jobs" rev-parse HEAD)" == "$JOBS_SHA" ]]
echo "R580_PRIVACY_SHA=$PRIVACY_SHA"
echo "R580_JOBS_SHA=$JOBS_SHA"
echo "R580_JOBS_TREE=$(git -C "$ROOT/jobs" rev-parse HEAD^{tree})"
step tests 90 node --test \
 "$ROOT/privacy/scripts/review-only/assert-privacy-jobs264-checkout.test.mjs" \
 "$ROOT/privacy/scripts/review-only/attest-jobs264-generated.test.mjs"
grep -E '^# (tests|pass|fail)' "$ROOT/tests.log" | tail -n 4 || true
step guard 60 node --input-type=module - "$ROOT/jobs" "$ROOT/privacy" <<'NODE'
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const [jobs,privacy]=process.argv.slice(2);
const guard=await import(pathToFileURL(privacy+'/scripts/review-only/assert-privacy-jobs264-checkout.mjs').href);
assert.equal(guard.assertPrivacyJobs264Checkout({directory:jobs,declaredSha:guard.EXACT_JOBS_SHA}),true);
console.log('R580_REAL_JOBS264_EXACT_SOURCE_GUARD=PASS');
NODE
step install 360 pnpm --dir "$ROOT/jobs" install --frozen-lockfile
step shared 150 npm --prefix "$ROOT/jobs/packages/shared-types" run build
step functions 180 npm --prefix "$ROOT/jobs/functions" run build
step manifest 80 node --input-type=module - "$ROOT/jobs" "$ROOT/privacy" <<'NODE'
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const [jobs,privacy]=process.argv.slice(2);
const source=await import(pathToFileURL(privacy+'/scripts/review-only/attest-jobs264-generated.mjs').href);
const observed=source.captureJobs264GeneratedManifest(jobs);
const parsed=JSON.parse(observed.manifest);
assert.equal(parsed.schemaVersion,'urai-jobs264-generated-tree-review-v2');
assert.equal(parsed.files.length,4);
assert.equal(source.assertJobs264GeneratedManifest({directory:jobs,manifest:observed.manifest,digest:observed.digest}),true);
console.log('R580_MANIFEST_SHA256='+observed.digest);
console.log('R580_TREE_SHA256='+parsed.treeSha256);
console.log('R580_TREE_FILE_COUNT='+parsed.treeCount);
console.log('R580_TREE_BYTES='+parsed.treeBytes);
console.log('R580_MANIFEST='+observed.manifest);
console.log('R580_ORIGINAL_JOBS264_COMPILED_ATTESTATION=PASS_REVIEW_ONLY');
NODE
grep '^R580_' "$ROOT/manifest.log"
echo R580_RESULT=PASS_REVIEW_ONLY_NOT_RELEASE
