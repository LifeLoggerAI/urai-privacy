import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const original = resolve(dirname(fileURLToPath(import.meta.url)), '../scripts/guard-firebase-deploy.mjs')
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'urai-privacy-guard-'))
  mkdirSync(join(root, 'scripts'))
  mkdirSync(join(root, 'bin'))
  copyFileSync(original, join(root, 'scripts/guard-firebase-deploy.mjs'))
  writeFileSync(join(root, 'firebase.json'), JSON.stringify({ functions: [{ source: 'functions', codebase: 'privacy', runtime: 'nodejs22' }] }))
  const fake = join(root, 'bin/firebase')
  writeFileSync(fake, '#!/usr/bin/env node\nimport { writeFileSync } from "node:fs";\nwriteFileSync(process.env.URAI_PRIVACY_FAKE_CALLS_FILE, JSON.stringify(process.argv.slice(2)));\n')
  chmodSync(fake, 0o755)
  writeFileSync(join(root, 'bin/package.json'), '{"type":"module"}')
  execFileSync('git', ['init', '-q'], { cwd: root })
  execFileSync('git', ['add', '.'], { cwd: root })
  execFileSync('git', ['-c', 'user.name=URAI Test', '-c', 'user.email=tests@example.invalid', 'commit', '-qm', 'isolated fixture'], { cwd: root })
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  const calls = join(root, 'firebase-invocation.json')
  const env = { ...process.env, PATH: join(root, 'bin') + ':' + process.env.PATH,
    URAI_PRIVACY_FAKE_CALLS_FILE: calls,
    URAI_PRIVACY_DEPLOY_STAGE: 'staging',
    URAI_PRIVACY_FIREBASE_PROJECT_ID: 'urai-staging',
    URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT: 'urai-staging',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'urai-staging',
    URAI_PRIVACY_DEPLOY_COMPONENTS: 'functions:privacy',
    URAI_PRIVACY_DEPLOY_SHA: sha,
    URAI_PRIVACY_DEPLOY_APPROVED_SHA: sha,
    URAI_PRIVACY_DEPLOY_EXECUTE: '1',
    URAI_PRIVACY_DEPLOY_APPROVAL: 'authorized-functions-only'
  }
  const run = (args = ['--execute'], overrides = {}) => spawnSync(process.execPath, [join(root, 'scripts/guard-firebase-deploy.mjs'), ...args], {
    cwd: root, env: { ...env, ...overrides }, encoding: 'utf8', timeout: 10000
  })
  return { root, sha, calls, run, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}

test('missing selector fails without invoking firebase', () => {
  const f = fixture(); try { const r = f.run([]); assert.notEqual(r.status, 0); assert.match(r.stderr, /Specify exactly/); assert.equal(existsSync(f.calls), false) } finally { f.cleanup() }
})
test('check-only validates identity and never invokes firebase', () => {
  const f = fixture(); try { const r = f.run(['--check-only']); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /VALIDATED \(no deployment\)/); assert.equal(existsSync(f.calls), false) } finally { f.cleanup() }
})
test('approved staging path only deploys privacy functions', () => {
  const f = fixture(); try { const r = f.run(); assert.equal(r.status, 0, r.stderr); assert.deepEqual(JSON.parse(readFileSync(f.calls, 'utf8')), ['deploy','--project','urai-staging','--only','functions:privacy','--non-interactive']) } finally { f.cleanup() }
})
const denied = [
  ['missing approval', { URAI_PRIVACY_DEPLOY_APPROVAL: '' }],
  ['missing execute flag', { URAI_PRIVACY_DEPLOY_EXECUTE: '0' }],
  ['missing project', { URAI_PRIVACY_FIREBASE_PROJECT_ID: '' }],
  ['production project', { URAI_PRIVACY_FIREBASE_PROJECT_ID: 'urai-4dc1d', URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT: 'urai-4dc1d' }],
  ['wrong expected project', { URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT: 'some-other-project' }],
  ['production mode', { URAI_PRIVACY_DEPLOY_STAGE: 'production' }],
  ['unreviewed Firestore and Storage rules', { URAI_PRIVACY_DEPLOY_COMPONENTS: 'firestore,storage' }],
  ['unreviewed hosting', { URAI_PRIVACY_DEPLOY_COMPONENTS: 'hosting' }],
  ['client project mismatch', { NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'urai-4dc1d' }],
  ['stale SHA', { URAI_PRIVACY_DEPLOY_SHA: 'a'.repeat(40) }],
  ['unapproved SHA', { URAI_PRIVACY_DEPLOY_APPROVED_SHA: 'b'.repeat(40) }]
]
for (const [label, changes] of denied) test(`${label} fails before Firebase invocation`, () => {
  const f = fixture(); try { const r = f.run(['--execute'], changes); assert.notEqual(r.status, 0, label); assert.equal(existsSync(f.calls), false) } finally { f.cleanup() }
})
test('dirty source fails without Firebase invocation', () => {
  const f = fixture(); try { writeFileSync(join(f.root, 'dirty.txt'), 'untracked'); const r=f.run(); assert.notEqual(r.status,0); assert.match(r.stderr,/dirty/); assert.equal(existsSync(f.calls),false) } finally { f.cleanup() }
})
test('CLI flag injection fails closed', () => {
  const f = fixture(); try { const r=f.run(['--execute','--only','firestore']); assert.notEqual(r.status,0); assert.equal(existsSync(f.calls),false) } finally { f.cleanup() }
})
test('changed codebase fails even with a matching approved commit', () => {
  const f=fixture(); try {
    writeFileSync(join(f.root,'firebase.json'), JSON.stringify({functions:[{source:'functions',codebase:'not-privacy'}]}))
    execFileSync('git',['add','.'],{cwd:f.root})
    execFileSync('git',['-c','user.name=URAI Test','-c','user.email=tests@example.invalid','commit','-qm','different codebase'],{cwd:f.root})
    const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:f.root,encoding:'utf8'}).trim()
    const r=f.run(['--execute'],{URAI_PRIVACY_DEPLOY_SHA:sha,URAI_PRIVACY_DEPLOY_APPROVED_SHA:sha})
    assert.notEqual(r.status,0); assert.equal(existsSync(f.calls),false)
  } finally { f.cleanup() }
})
