// Local-only selected production entry points; do not deploy this fixture.
const entry = require('../../lib/functions-entry.js');
for (const name of ['createDeletionRequest', 'authorizeJobsDeletionBinding', 'recordJobsDeletionParticipantEvidence', 'reconcileDeletionParticipants']) exports[name] = entry[name];
