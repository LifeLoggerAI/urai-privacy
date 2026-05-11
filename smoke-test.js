const http = require('http');

const pages = ['/', '/privacy', '/health'];
const port = 3000; // Default Next.js port

async function runSmokeTests() {
  console.log('Running smoke tests...');

  for (const page of pages) {
    try {
      const statusCode = await fetchPage(page);
      if (statusCode !== 200) {
        console.error(`Smoke test failed for ${page}. Expected status 200, but got ${statusCode}.`);
        process.exit(1);
      }
      console.log(`- ${page} -> Status ${statusCode} OK`);
    } catch (error) {
      console.error(`Smoke test failed for ${page}. Error: ${error.message}`);
      process.exit(1);
    }
  }

  console.log('All smoke tests passed!');
  process.exit(0);
}

function fetchPage(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode);
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

runSmokeTests();
