import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLegacyExportSurface } from '../scripts/assert-no-legacy-export-callables.mjs';
const safe = () => ({
  index: 'export const executeDeletionRequest = onCall(async () => {}); const v = "privacy-deletion-plan-v4";',
  entry: 'export { processExportRequest } from "./export-request"; export { getExportDownloadUrl, downloadExportPackage, cleanupExpiredExportPackages } from "./export-lifecycle-functions"; export { createDeletionRequest } from "./index";',
  processor: 'export const processExportRequest = onCall(async () => {});',
  broker: 'export const downloadExportPackage = onRequest(async () => {});'
});
test('accepts the isolated broker and leaves deletion in the compatibility module', () => assert.equal(checkLegacyExportSurface(safe()).pass, true));
const rejects = (name, edit, marker) => test(name, () => { const source = safe(); edit(source); assert.ok(checkLegacyExportSurface(source).violations.includes(marker)); });
rejects('rejects raw GCS signed URL minting', x => { x.index += ' await object.getSignedUrl({action:"read"});'; }, 'legacy_gcs_signed_url');
rejects('rejects old exported URL callable', x => { x.index += ' export const getExportDownloadUrl = onCall(async () => {});'; }, 'legacy_export_url_callable');
rejects('rejects old processor callable', x => { x.index += ' export const processExportRequest = onCall(async () => {});'; }, 'legacy_export_processor');
rejects('rejects resurrected legacy processor schema', x => { x.index += ' const processExportSchema = {}'; }, 'legacy_export_admission_artifacts');
rejects('requires live deletion source to remain present', x => { x.index = ''; }, 'preserve_versioned_deletion');
rejects('requires canonical processor export', x => { x.entry = x.entry.replace('export { processExportRequest } from "./export-request";', ''); }, 'canonical_processor_entry');
rejects('requires canonical broker export', x => { x.entry = x.entry.replace('downloadExportPackage, ', ''); }, 'canonical_broker_entry');
rejects('requires canonical broker implementation', x => { x.broker = ''; }, 'canonical_broker_implementation');
rejects('rejects a broker that mints raw GCS URLs', x => { x.broker += 'await object.getSignedUrl({action:"read"});'; }, 'broker_issues_raw_signed_url');
rejects('rejects legacy download reexport from index', x => { x.entry += ' export { getExportDownloadUrl } from "./index";'; }, 'legacy_index_export');
rejects('rejects wildcard index export', x => { x.entry += ' export * from "./index";'; }, 'legacy_index_export');
