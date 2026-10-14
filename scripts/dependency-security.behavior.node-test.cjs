'use strict';

const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const { Readable, Writable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { test } = require('node:test');
const path = require('node:path');

const rootRequire = createRequire(path.resolve(__dirname, '../package.json'));
const cliRequire = createRequire(rootRequire.resolve('firebase-tools/package.json'));
const globRequire = createRequire(rootRequire.resolve('fast-glob/package.json'));
const micromatchRequire = createRequire(globRequire.resolve('micromatch/package.json'));
const consumers = [
  ['Firebase CLI watcher', createRequire(cliRequire.resolve('chokidar/package.json'))('braces')],
  ['Next ESLint fast-glob/micromatch', micromatchRequire('braces')],
];

for (const [name, braces] of consumers) {
  test(`${name} resolves the licensed guard fork`, () => {
    const resolved = braces.parse('src/**/*.{js,ts,tsx}');
    assert.equal(resolved.type, 'root');
    assert.equal(rootRequire('braces/package.json').version, '3.0.3-urai.1');
    assert.equal(rootRequire('braces/package.json').license, 'MIT');
  });
  test(`${name} retains ordinary patterns and range expansion`, () => {
    assert.deepEqual(braces('src/**/*.{js,ts,tsx}'), ['src/**/*.(js|ts|tsx)']);
    assert.deepEqual(braces.expand('file-{1..3}.txt'), ['file-1.txt', 'file-2.txt', 'file-3.txt']);
    assert.deepEqual(braces.expand('{a,{b,c}}'), ['a', 'b', 'c']);
  });
  test(`${name} bounds hostile text and direct caller ASTs`, () => {
    for (const method of ['parse', 'compile', 'expand', 'stringify']) {
      assert.doesNotThrow(() => braces[method]('{'.repeat(128) + 'x' + '}'.repeat(128)));
      assert.throws(() => braces[method]('('.repeat(4000) + 'x' + ')'.repeat(4000)),
        { name: 'SyntaxError', message: /maximum depth/ });
    }
    for (const method of ['compile', 'expand', 'stringify']) {
      const ast = { type: 'root', nodes: [] };
      let node = ast;
      for (let depth = 0; depth < 4000; depth++) {
        const child = { type: 'paren', parent: node, nodes: [] };
        node.nodes.push(child); node = child;
      }
      node.nodes.push({ type: 'text', value: 'x' });
      assert.throws(() => braces[method](ast), { name: 'SyntaxError', message: /maximum depth/ });
    }
  });
}

test('actual fast-glob and micromatch consumers retain file selection behavior', () => {
  const micromatch = globRequire('micromatch');
  assert.deepEqual(micromatch(['src/a.ts', 'src/b.tsx', 'src/c.css'], 'src/**/*.{ts,tsx}'),
    ['src/a.ts', 'src/b.tsx']);
  assert.equal(globRequire('fast-glob').isDynamicPattern('src/**/*.{ts,tsx}'), true);
});

test('the current Firebase CLI dynamically loads its repaired upstream ESM stream graph', async () => {
  assert.equal(cliRequire('firebase-tools/package.json').version, '15.32.1');
  const { loadStreamJson } = cliRequire('./lib/streamJson.js');
  const loaded = await loadStreamJson();
  for (const name of ['chain', 'many', 'parser', 'pick', 'filter', 'streamArray', 'streamObject']) {
    assert.equal(typeof loaded[name], 'function', name);
  }
  const results = [];
  await pipeline(loaded.chain([Readable.from(['{"memories":[{"id":"a"},{"id":"b"}]}']),
    loaded.parser(), loaded.pick({ filter: 'memories' }), loaded.streamArray()]),
  new Writable({ objectMode: true, write(value, _encoding, done) { results.push(value.value); done(); } }));
  assert.deepEqual(results, [{ id: 'a' }, { id: 'b' }]);
});

test('the actual CLI streaming assembler keeps dangerous names as data properties', async () => {
  const { loadStreamJson } = cliRequire('./lib/streamJson.js');
  const loaded = await loadStreamJson();
  const source = '{"__proto__":{"polluted":true},"constructor":{"safe":true},"nested":{"__proto__":{"injected":true}}}';
  const results = [];
  await pipeline(loaded.chain([Readable.from([source]), loaded.parser(), loaded.streamObject()]),
    new Writable({ objectMode: true, write(value, _encoding, done) { results.push(value); done(); } }));
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(Object.prototype.injected, undefined);
  assert.deepEqual(results.find(value => value.key === '__proto__').value, { polluted: true });
  const nested = results.find(value => value.key === 'nested').value;
  assert.equal(Object.getPrototypeOf(nested), Object.prototype);
  assert.equal(Object.hasOwn(nested, '__proto__'), true);
  assert.deepEqual(nested.__proto__, { injected: true });
});

test('upstream streaming filter accepts ordinary nesting and refuses pathological depth',
  { timeout: 5000 }, async () => {
    const { loadStreamJson } = cliRequire('./lib/streamJson.js');
    const loaded = await loadStreamJson();
    const ordinary = '['.repeat(128) + '0' + ']'.repeat(128);
    await pipeline(loaded.chain([Readable.from([ordinary]), loaded.parser(), loaded.filter({ filter: () => false })]),
      new Writable({ objectMode: true, write(_value, _encoding, done) { done(); } }));
    const source = '['.repeat(4000) + '0' + ']'.repeat(4000);
    await assert.rejects(pipeline(loaded.chain([Readable.from([source]), loaded.parser(),
      loaded.filter({ filter: () => false })]),
    new Writable({ objectMode: true, write(_value, _encoding, done) { done(); } })),
    { name: 'RangeError', message: /JSON nesting depth exceeds maxDepth/ });
  });

test('CLI CSV and FTP consumers retain their supported public APIs', () => {
  const { parse } = cliRequire('csv-parse/sync');
  assert.deepEqual(parse('name,value\na,1\n', { columns: true }), [{ name: 'a', value: '1' }]);
  const rows = parse('__proto__,value\nowned,1\n', { columns: true });
  assert.equal(Object.getPrototypeOf(rows[0]), Object.prototype);
  assert.equal(rows[0].value, '1');
  const transport = createRequire(cliRequire.resolve('get-uri/package.json'))('basic-ftp');
  const ftp = new transport.Client();
  for (const name of ['access', 'lastMod', 'list', 'downloadTo', 'close']) assert.equal(typeof ftp[name], 'function');
  ftp.close();
});
