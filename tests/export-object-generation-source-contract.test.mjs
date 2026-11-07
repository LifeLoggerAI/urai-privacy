import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const worker=readFileSync('functions/src/export-request.ts','utf8');
const broker=readFileSync('functions/src/export-lifecycle-functions.ts','utf8');
const policy=readFileSync('functions/src/export-object-generation-policy.ts','utf8');
test('export writes are create-only and require verified metadata generations',()=>{
 assert.match(worker,/preconditionOpts:\s*\{\s*ifGenerationMatch:\s*0\s*\}/);
 assert.match(worker,/matchingExportObjectMetadata\(/);
 assert.match(worker,/const \[metadata\] = await object\.getMetadata\(\)/);
});
test('publication binds both export and manifest generations into job records',()=>{
 assert.match(worker,/exportGeneration:\s*exportFile\.generation/);
 assert.match(worker,/manifestGeneration:\s*manifestFile\.generation/);
});
test('broker denies unpinned and legacy export descriptors',()=>{
 assert.match(broker,/canonicalGcsGeneration\(file === "manifest" \? job\.manifestGeneration : job\.exportGeneration\)/);
 assert.match(broker,/exactExportArtifactPath\(uid,\s*jobId,\s*path\)/);
 assert.match(broker,/identityHash = digest\(\{\s*uid,\s*requestId,\s*path,\s*file,\s*generation,\s*checksum/);
});
test('callable checks exact object generation and SHA metadata before issuing descriptor',()=>{
 assert.match(broker,/bucket\.file\(path,\s*\{\s*generation:\s*authority\.generation\s*\}\)/);
 assert.match(broker,/matchingExportObjectMetadata\(\{\s*generation:\s*authority\.generation,\s*sha256:\s*authority\.checksum\s*\}/);
});
test('stream reads only the authorized exact Storage generation',()=>{
 assert.match(broker,/bucket\.file\(authority\.path,\s*\{\s*generation:\s*authority\.generation\s*\}\)/);
 assert.match(broker,/const stream = object\.createReadStream\(\)/);
 assert.match(broker,/for \(let offset = 0; offset < chunk\.length; offset \+= 64 \* 1024\)/);
});
test('generation comparisons cannot round large 64-bit identifiers',()=>{
 assert.match(policy,/BigInt\(raw\)/);
 assert.match(policy,/typeof raw !== "string"/);
 assert.doesNotMatch(policy,/Number\(raw\)/);
});
