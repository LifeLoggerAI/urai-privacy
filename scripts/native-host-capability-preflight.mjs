import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// R841: reject hosts that cannot run the pinned Firebase 15.x emulators
// before spending time on frozen installs. Local, credential-free probes only.
export const EMULATOR_PORTS = Object.freeze([9099, 8080, 5001, 9199, 4400, 4500, 9299]);

export function checkJavaVersion(env = process.env) {
  const java = spawnSync('java', ['-version'], { encoding: 'utf8', timeout: 5000, env });
  const output = (java.stderr || '') + '\n' + (java.stdout || '');
  const match = output.match(/(?:openjdk|java) version "(?:1\.)?(\d+)(?:[.\"])/i);
  if (java.error || java.status !== 0 || !match || Number(match[1]) < 21) {
    throw new Error('JAVA_VERSION Java 21+ is required');
  }
  return Number(match[1]);
}

export function checkChildProcess() {
  const child = spawnSync(process.execPath, ['-e', "process.stdout.write('child-ok')"], {
    encoding: 'utf8', timeout: 5000,
  });
  if (child.error || child.status !== 0 || child.stdout !== 'child-ok') {
    throw new Error('CHILD_PROCESS');
  }
}

export async function probePorts(ports) {
  for (const port of ports) {
    await new Promise((resolveListen, reject) => {
      const server = createServer();
      server.once('error', (error) => reject(new Error('PORT_UNAVAILABLE port=' + port + ' reason=' + (error.code || 'UNKNOWN'))));
      server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
        server.close((error) => error ? reject(new Error('PORT_CLOSE port=' + port)) : resolveListen());
      });
    });
  }
}

// The real runner uses only the fixed emulator port list; there is no
// test-mode environment override that could silently skip production checks.
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    if (Number(process.versions.node.split('.')[0]) !== 22) throw new Error('NODE_VERSION');
    const javaMajor = checkJavaVersion();
    checkChildProcess();
    await probePorts(EMULATOR_PORTS);
    console.log('URAI_NATIVE_HOST_CAPABILITY_PASS java=' + javaMajor + ' child=true localPorts=' + EMULATOR_PORTS.join(','));
  } catch (error) {
    console.error('URAI_NATIVE_HOST_BLOCKED code=' + error.message);
    process.exitCode = 1;
  }
}
