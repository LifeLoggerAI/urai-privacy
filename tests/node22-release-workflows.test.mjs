import test from 'node:test';
import assert from 'node:assert/strict';
import { checkNode22ReleaseWorkflows, expectedWorkflows } from '../scripts/assert-node22-release-workflows.mjs';
const valid = () => ({
  functionsManifest: JSON.stringify({ engines: { node: '22' } }),
  releaseScript: 'node --experimental-strip-types --test tests/deletion-document-version.test.mjs',
  workflows: Object.fromEntries(Object.entries(expectedWorkflows).map(([path, count]) =>
    [path, `jobs:\n  build:\n    steps:\n      - uses: actions/setup-node@pinned\n${'      - with:\n          node-version: "22.16.0"\n'.repeat(count)}`]))
});
const rejects = (label, edit, code) => test(label, () => {
  const value = valid(); edit(value);
  assert.ok(checkNode22ReleaseWorkflows(value).failures.some(x => x.startsWith(code)));
});
test('the six explicit source workflow policies accept Node 22.16.0', () => {
  assert.deepEqual(checkNode22ReleaseWorkflows(valid()), {pass:true, failures:[]});
});
rejects('old Node 20 cannot be promoted', x => { const p=Object.keys(expectedWorkflows)[0]; x.workflows[p]=x.workflows[p].replace('22.16.0','20.19.0'); }, 'invalid_node_version:');
rejects('partial multi-job workflow upgrade fails', x => { const p=Object.keys(expectedWorkflows)[0]; x.workflows[p]=x.workflows[p].replace('node-version: "22.16.0"','node-version: "20.19.0"'); }, 'invalid_node_version:');
rejects('missing workflow fails closed', x => { delete x.workflows[Object.keys(expectedWorkflows)[1]]; }, 'missing_workflow:');
rejects('missing pinned setup-node step fails closed', x => { const p=Object.keys(expectedWorkflows)[2]; x.workflows[p]=x.workflows[p].replace('actions/setup-node@pinned','actions/checkout@pinned'); }, 'missing_setup_node:');
rejects('missing Node version specification fails', x => { const p=Object.keys(expectedWorkflows)[3]; x.workflows[p]=x.workflows[p].replace('node-version: "22.16.0"','cache: npm'); }, 'invalid_node_version:');
rejects('Functions engine must be Node 22', x => { x.functionsManifest=JSON.stringify({engines:{node:'20'}}); }, 'functions_node22_engine_required');
rejects('release verification must retain the Node22 strip-types tests', x => { x.releaseScript='npm test'; }, 'node22_tests_required');
