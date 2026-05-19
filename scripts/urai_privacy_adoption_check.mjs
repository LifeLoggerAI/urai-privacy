import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const registryPath = join(root, 'privacy/system-of-systems/registry.json');
const lockPath = join(root, 'docs/LOCK.md');

const expectedRepos = [
  'LifeLoggerAI/UrAi',
  'LifeLoggerAI/UrAiProd',
  'LifeLoggerAI/urai-admin',
  'LifeLoggerAI/urai-analytics',
  'LifeLoggerAI/urai-communications',
  'LifeLoggerAI/urai-studio',
  'LifeLoggerAI/urai-spatial',
  'LifeLoggerAI/urai-foundation',
  'LifeLoggerAI/B2Bportal',
  'LifeLoggerAI/asset-factory'
];

const requiredControls = [
  'consent',
  'export',
  'deletion',
  'retention',
  'audit',
  'adminAccess',
  'dataMinimization',
  'incidentResponse'
];

const requiredCollections = [
  'privacyRequests',
  'exportJobs',
  'deletionRequests',
  'consentRecords',
  'consentEvents',
  'auditLogs',
  'adminActions',
  'privacyEvidence'
];

const requiredCallables = [
  'createExportRequest',
  'processExportRequest',
  'createDeletionRequest',
  'processDeletionRequest',
  'updateConsent',
  'recordAdminAction',
  'getPrivacyHealthReport'
];

const failures = [];

function fail(message) {
  failures.push(message);
}

function hasAllStrings(values, required, label) {
  for (const item of required) {
    if (!Array.isArray(values) || !values.includes(item)) {
      fail(`Missing ${label}: ${item}`);
    }
  }
}

if (!existsSync(registryPath)) {
  fail('Missing privacy/system-of-systems/registry.json');
} else {
  let registry;
  try {
    registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  } catch (error) {
    fail(`Invalid system-of-systems registry JSON: ${error.message}`);
  }

  if (registry) {
    if (registry.schemaVersion !== '2026-05-17.system-of-systems.v1') {
      fail('Unexpected registry schemaVersion; update audit before changing schema.');
    }

    if (registry.controlPlane?.repo !== 'LifeLoggerAI/urai-privacy') {
      fail('Registry controlPlane.repo must be LifeLoggerAI/urai-privacy.');
    }

    hasAllStrings(registry.requiredControls, requiredControls, 'registry required control');
    hasAllStrings(registry.controlPlane?.canonicalCollections, requiredCollections, 'canonical collection');
    hasAllStrings(registry.controlPlane?.canonicalCallables, requiredCallables, 'canonical callable');

    const systems = Array.isArray(registry.systems) ? registry.systems : [];
    if (systems.length !== expectedRepos.length) {
      fail(`Expected ${expectedRepos.length} Tier-One system entries, found ${systems.length}.`);
    }

    const repos = new Set();
    const ids = new Set();

    for (const system of systems) {
      if (!system || typeof system !== 'object') {
        fail('Each system entry must be an object.');
        continue;
      }

      if (!system.id || typeof system.id !== 'string') {
        fail(`System entry for repo ${system.repo ?? '<unknown>'} is missing id.`);
      } else if (ids.has(system.id)) {
        fail(`Duplicate system id: ${system.id}`);
      } else {
        ids.add(system.id);
      }

      if (!expectedRepos.includes(system.repo)) {
        fail(`Unexpected or missing repo in system registry: ${system.repo ?? '<missing>'}`);
      } else if (repos.has(system.repo)) {
        fail(`Duplicate repo in system registry: ${system.repo}`);
      } else {
        repos.add(system.repo);
      }

      if (system.tier !== 'tier-one') {
        fail(`${system.repo ?? system.id} must be marked tier-one.`);
      }

      if (system.integrationStatus !== 'control-plane-contract-mapped') {
        fail(`${system.repo ?? system.id} must be control-plane-contract-mapped until live adoption evidence is recorded.`);
      }

      if (!Array.isArray(system.dataDomains) || system.dataDomains.length === 0) {
        fail(`${system.repo ?? system.id} must list dataDomains.`);
      }

      if (!Array.isArray(system.releaseEvidence) || !system.releaseEvidence.includes('audit:privacy gate')) {
        fail(`${system.repo ?? system.id} must list audit:privacy gate as release evidence.`);
      }

      for (const control of requiredControls) {
        const evidence = system.requiredAdoption?.[control];
        if (!evidence || typeof evidence !== 'string' || evidence.length < 20) {
          fail(`${system.repo ?? system.id} is missing substantive requiredAdoption.${control}.`);
        }
      }
    }

    for (const expectedRepo of expectedRepos) {
      if (!repos.has(expectedRepo)) {
        fail(`Missing expected Tier-One repo from registry: ${expectedRepo}`);
      }
    }
  }
}

if (!existsSync(lockPath)) {
  fail('Missing docs/LOCK.md');
} else {
  const lock = readFileSync(lockPath, 'utf8');
  for (const repo of expectedRepos) {
    if (!lock.includes(`\`${repo}\``)) {
      fail(`docs/LOCK.md must include cross-repo adoption row for ${repo}.`);
    }
  }
}

if (failures.length > 0) {
  console.error('[audit:privacy] FAILED');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('[audit:privacy] OK: system-of-systems privacy adoption registry is complete');
