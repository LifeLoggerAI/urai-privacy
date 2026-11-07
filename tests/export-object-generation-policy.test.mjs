import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalGcsGeneration, matchingGcsGeneration, matchingExportObjectMetadata, exactExportArtifactPath
} from '../functions/src/export-object-generation-policy.ts';
const id = 'exports/u1/job1/123e4567-e89b-12d3-a456-426614174000/export.json';
const sha='a'.repeat(64);
test('retains large exact int64 generation without precision loss',()=>assert.equal(canonicalGcsGeneration('9007199254740993'),'9007199254740993'));
test('rejects unsafe numbers even if integer-valued',()=>assert.equal(canonicalGcsGeneration(9007199254740993),null));
test('rejects negative and zero generations',()=>{for(const v of ['-1','0',0,-1])assert.equal(canonicalGcsGeneration(v),null)});
test('rejects padded and formatted generation IDs',()=>{for(const v of ['01','1.0',' 1','1 ','1e3','+1'])assert.equal(canonicalGcsGeneration(v),null)});
test('rejects anything above signed int64',()=>assert.equal(canonicalGcsGeneration('9223372036854775808'),null));
test('accepts signed-int64 maximum',()=>assert.equal(canonicalGcsGeneration('9223372036854775807'),'9223372036854775807'));
test('rejects changed generation at same name',()=>assert.equal(matchingGcsGeneration('9007199254740993','9007199254740994'),null));
test('accepts matching exact generation',()=>assert.equal(matchingGcsGeneration('9007199254740993','9007199254740993'),'9007199254740993'));
test('requires exact SHA256 custom metadata',()=>assert.equal(matchingExportObjectMetadata({generation:'6',sha256:sha},{generation:'6',metadata:{sha256:sha}}),'6'));
test('rejects metadata hash mismatch',()=>assert.equal(matchingExportObjectMetadata({generation:'6',sha256:sha},{generation:'6',metadata:{sha256:'b'.repeat(64)}}),null));
test('rejects inherited metadata hash',()=>assert.equal(matchingExportObjectMetadata({generation:'6',sha256:sha},{generation:'6',metadata:Object.create({sha256:sha})}),null));
test('rejects accessor metadata hash',()=>{const meta={};Object.defineProperty(meta,'sha256',{get(){throw Error('getter')}});assert.equal(matchingExportObjectMetadata({generation:'6',sha256:sha},{generation:'6',metadata:meta}),null)});
test('rejects unexpected generation and missing metadata',()=>{assert.equal(matchingExportObjectMetadata({generation:'6',sha256:sha},{generation:'7',metadata:{sha256:sha}}),null);assert.equal(matchingExportObjectMetadata({generation:'6',sha256:sha},{generation:'6'}),null)});
test('permits scoped export object path',()=>assert.equal(exactExportArtifactPath('u1','job1',id),true));
test('rejects other owner and job paths',()=>{assert.equal(exactExportArtifactPath('u2','job1',id),false);assert.equal(exactExportArtifactPath('u1','job2',id),false)});
test('rejects path traversal and arbitrary objects',()=>{assert.equal(exactExportArtifactPath('u1','job1','exports/u1/job1/../secret.json'),false);assert.equal(exactExportArtifactPath('u1','job1','exports/u1/job1/file.txt'),false)});
