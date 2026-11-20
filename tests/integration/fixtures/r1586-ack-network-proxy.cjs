'use strict';
const http = require('node:http');
const path = '/urai-privacy-r1512-disposable/us-central1/acknowledgeConsentRevocation';
const counters = { forwarded: 0, successes: 0, stops: 0, starts: 0, dropped: 0 };
let endpoint;
let armed = false;
async function start() {
  if(endpoint) throw Error('already listening');
  endpoint = http.createServer((req, res) => {
    if (req.url !== path || req.method !== 'POST') { res.writeHead(404).end(); return; }
    // Jobs reaches this callback only after durable enforcement. Drop before forwarding.
    if (armed) { armed = false; counters.dropped++; req.destroy(); stop().catch(() => {}); return; }
    counters.forwarded++;
    const upstream = http.request({ hostname: '127.0.0.1', port: 5001, path,
      method: 'POST', headers: { 'content-type': 'application/json', authorization: req.headers.authorization || '' } }, reply => {
      if (reply.statusCode === 200) counters.successes++;
      res.writeHead(reply.statusCode || 502, { 'content-type': 'application/json' }); reply.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); }); req.pipe(upstream);
  });
  await new Promise((resolve, reject) => { endpoint.once('error', reject); endpoint.listen(5003, '127.0.0.1', resolve); }); counters.starts++;
}
async function stop() {
  const current = endpoint; if (!current) return; endpoint = undefined;
  await new Promise(resolve => { current.close(resolve); current.closeAllConnections(); }); counters.stops++;
}
const control = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/arm') armed = true;
    else if (req.method === 'POST' && req.url === '/stop') await stop();
    else if (req.method === 'POST' && req.url === '/start') await start();
    else if (req.method !== 'GET' || req.url !== '/status') { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ listening: Boolean(endpoint), armed, endpoint: 'http://127.0.0.1:5003' + path, ...counters }));
  } catch { res.writeHead(500).end(); }
});
start().then(() => control.listen(5004, '127.0.0.1', () => console.log('ACK_PROXY_READY'))).catch(() => process.exit(1));
process.on('SIGTERM', async () => { await stop(); control.close(() => process.exit(0)); });
