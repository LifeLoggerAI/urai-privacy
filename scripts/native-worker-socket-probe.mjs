import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Firebase Functions needs a local Unix worker socket. Probe this OS
// capability before spending time on frozen dependency installations.
const directory = mkdtempSync(join(tmpdir(), 'urai-fn-worker-'));
const socketPath = join(directory, 'worker.sock');
const server = createServer();

function cleanup() {
  rmSync(directory, { recursive: true, force: true });
}

server.once('error', (error) => {
  console.error(`URAI_NATIVE_WORKER_SOCKET_BLOCKED code=${error.code || 'UNKNOWN'}`);
  cleanup();
  process.exitCode = 1;
});

server.listen(socketPath, () => {
  console.log('URAI_NATIVE_WORKER_SOCKET_CAPABILITY_PASS');
  server.close(() => cleanup());
});
