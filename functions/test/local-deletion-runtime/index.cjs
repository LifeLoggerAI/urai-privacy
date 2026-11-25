const entry = require('../../lib/functions-entry.js');
for (const name of ['createDeletionRequest', 'processDeletionRequest', 'executeDeletionRequest']) exports[name] = entry[name];
