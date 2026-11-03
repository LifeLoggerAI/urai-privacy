#!/usr/bin/env node
/**
 * Fail-closed non-production deployment entrypoint for the Privacy Functions
 * codebase only. Shared Firestore/Storage rules and Hosting must be released
 * through their separately reviewed cross-repository owner, never this script.
 * This script does NOT certify consent, CI, or a production release.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const die = (reason) => { console.error(`[privacy-deploy-guard] BLOCKED: ${reason}`); process.exit(1) }
const mode = process.argv[2]
if (!['--check-only', '--execute'].includes(mode) || process.argv.length !== 3) {
  die('Specify exactly --check-only or --execute; arbitrary Firebase CLI flags are forbidden.')
}
const env = process.env
if (env.URAI_PRIVACY_DEPLOY_STAGE !== 'staging') die('Only reviewed staging function deployments are supported by this entrypoint.')
if (env.URAI_PRIVACY_FIREBASE_PROJECT_ID !== 'urai-staging' ||
    env.URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT !== 'urai-staging') {
  die('Both explicit project selectors must be urai-staging; production/shared-project override is forbidden.')
}
if (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'urai-staging') {
  die('Public Firebase client project conflicts with the intended staging target.')
}
if (env.URAI_PRIVACY_DEPLOY_COMPONENTS !== 'functions:privacy') {
  die('Only functions:privacy is allowed; shared Firestore, Storage and Hosting deploys are forbidden.')
}
let actualSha = ''
try {
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8' }).trim()
  if (realpathSync(repoRoot) !== realpathSync(root)) die('Script must execute from the checked-out Privacy repository root.')
  actualSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' })
  if (status.trim()) die('Checked-out source is dirty; commit and verify the exact source first.')
} catch {
  die('Cannot verify a clean Git checkout with exact HEAD provenance.')
}
if (!/^[a-f0-9]{40}$/.test(actualSha) ||
    env.URAI_PRIVACY_DEPLOY_SHA !== actualSha ||
    env.URAI_PRIVACY_DEPLOY_APPROVED_SHA !== actualSha) {
  die('Current Git HEAD and both expected/approved source SHAs must match exactly.')
}
try {
  const config = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8'))
  if (!Array.isArray(config.functions) || config.functions.length !== 1 ||
      config.functions[0]?.codebase !== 'privacy' ||
      config.functions[0]?.source !== 'functions') die('Firebase codebase mapping changed; stop and review.')
} catch {
  die('Cannot validate committed Firebase codebase identity.')
}
if (mode === '--check-only') {
  console.log(`[privacy-deploy-guard] VALIDATED (no deployment): stage=staging project=urai-staging only=functions:privacy sha=${actualSha}`)
  process.exit(0)
}
if (env.URAI_PRIVACY_DEPLOY_EXECUTE !== '1' ||
    env.URAI_PRIVACY_DEPLOY_APPROVAL !== 'authorized-functions-only') {
  die('Explicit, separately authorized staging functions-only execution approval is required.')
}
console.log(`[privacy-deploy-guard] Executing scoped staging Functions deploy for exact SHA ${actualSha}`)
const result = spawnSync('firebase', [
  'deploy', '--project', 'urai-staging', '--only', 'functions:privacy', '--non-interactive'
], { cwd: root, stdio: 'inherit', shell: false, env })
if (result.error) die(`Firebase CLI failed to start: ${result.error.code ?? 'unknown'}`)
if (result.signal) die(`Firebase CLI terminated by signal ${result.signal}`)
process.exit(Number.isInteger(result.status) ? result.status : 1)
