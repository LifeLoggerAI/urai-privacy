import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { checkJavaVersion, checkChildProcess, probePorts, EMULATOR_PORTS } from '../../scripts/native-host-capability-preflight.mjs';

function withJava(major, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'urai-r841-java-'));
  try {
    const bin = join(dir, 'java');
    writeFileSync(bin, '#!/bin/sh\nprintf \'openjdk version "' + major + '.0.1"\\n\' >&2\n');
    chmodSync(bin, 0o700);
    return fn({ ...process.env, PATH: dir + ':' + (process.env.PATH || '') });
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('R841 accepts Java 21 and a real Node child without cloud resources', () => {
  assert.equal(withJava(21, checkJavaVersion), 21);
  assert.doesNotThrow(() => checkChildProcess());
});

test('R841 Java 17 is rejected before dependency installations', () => {
  assert.throws(() => withJava(17, checkJavaVersion), /JAVA_VERSION/);
});

test('R841 localhost bind succeeds on a disposable unused port', async () => {
  const server = createServer();
  await new Promise((res, rej) => server.once('error', rej).listen(0, '127.0.0.1', res));
  const port = server.address().port;
  await new Promise(res => server.close(res));
  await assert.doesNotReject(probePorts([port]));
});

test('R841 occupied local port fails closed', async () => {
  const server = createServer();
  await new Promise((res, rej) => server.once('error', rej).listen(0, '127.0.0.1', res));
  try {
    await assert.rejects(probePorts([server.address().port]), /PORT_UNAVAILABLE/);
  } finally { await new Promise(res => server.close(res)); }
});

test('R841 production port list is fixed to real emulator configuration', () => {
  assert.deepEqual(EMULATOR_PORTS, [9099, 8080, 5001, 9199, 4400, 4500, 9299]);
  assert.equal(Object.isFrozen(EMULATOR_PORTS), true);
});
