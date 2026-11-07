import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync('functions/src/export-request.ts','utf8');
const lifecycle=readFileSync('functions/src/export-lifecycle-functions.ts','utf8');
const maintenance=readFileSync('functions/src/export-attempt-maintenance.ts','utf8');
const cleaner=readFileSync('functions/src/export-generation-cleanup.ts','utf8');
const policy=readFileSync('functions/src/export-object-generation-policy.ts','utf8');
test('destructive Storage calls are only made under string generation precondition',()=>{
 assert.match(cleaner,/preconditionOpts:\s*\{\s*ifGenerationMatch:\s*generation\s*\}/);
 assert.match(cleaner,/approvedExportCleanupGeneration\(args\)/);
 assert.match(cleaner,/if \(!generation\)/);
 assert.doesNotMatch(cleaner,/bucket\.file\(args\.path\)\.delete\(/);
});
test('export worker records each generation while processing before possible failure',()=>{
 assert.match(worker,/createdGenerations\[exportPath\]\s*=\s*exportFile\.generation/);
 assert.match(worker,/createdGenerations\[manifestPath\]\s*=\s*manifestFile\.generation/);
 assert.match(worker,/recordGeneration\("exportGeneration",\s*exportFile\.generation\)/);
 assert.match(worker,/recordGeneration\("manifestGeneration",\s*manifestFile\.generation\)/);
 assert.match(worker,/tx\.update\(attemptRef,\s*\{\s*\[field\]:\s*generation/);
});
test('export worker failure cleanup is pinned and persists identities for retries',()=>{
 assert.match(worker,/removeExportArtifacts\(\[exportPath,\s*manifestPath\],\s*async\s*\(path\)/);
 assert.match(worker,/deleteApprovedExportArtifact\(/);
 assert.match(worker,/exportGeneration:\s*createdGenerations\[exportPath\]/);
 assert.match(worker,/manifestGeneration:\s*createdGenerations\[manifestPath\]/);
 assert.doesNotMatch(worker,/getStorage\(\)\.bucket\(\)\.file\(path\)\.delete\(/);
});
test('expiry and failed-job cleanup verify both generation bindings',()=>{
 assert.match(lifecycle,/approvedExportCleanupGeneration\(\{\s*\.\.\.binding,\s*path\s*\}\)/);
 assert.match(lifecycle,/cleanupReason:\s*"MISSING_EXACT_EXPORT_GENERATION"/);
 assert.match(lifecycle,/deleteApprovedExportArtifact\(\{\s*\.\.\.binding,\s*path\s*\}\)/);
 assert.match(lifecycle,/deleteApprovedExportArtifact\(\{\s*\.\.\.claim,\s*path\s*\}\)/);
 assert.doesNotMatch(lifecycle,/bucket\.file\(path\)\.delete\(/);
});
test('attempt maintenance never deletes by object name or infers missing generations',()=>{
 assert.match(maintenance,/exportGeneration:\s*attempt\.exportGeneration/);
 assert.match(maintenance,/manifestGeneration:\s*attempt\.manifestGeneration/);
 assert.match(maintenance,/approvedExportCleanupGeneration\(\{\s*\.\.\.binding,\s*path\s*\}\)/);
 assert.match(maintenance,/deleteApprovedExportArtifact\(\{\s*\.\.\.claim,\s*path\s*\}\)/);
 assert.doesNotMatch(maintenance,/getStorage\(\)\.bucket\(\)\.file\(path\)\.delete\(/);
});
test('the pure cleanup admission verifies subject, path and exact generation',()=>{
 assert.match(policy,/export function approvedExportCleanupGeneration/);
 assert.match(policy,/exactExportArtifactPath\(uid,\s*jobId,\s*path\)/);
 assert.match(policy,/canonicalGcsGeneration\(approved\)/);
});
