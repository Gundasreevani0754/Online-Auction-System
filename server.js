import { createApp } from './src/app.js';
import { HOST, PORT } from './src/config.js';
import { closeDb, getDb } from './src/db/index.js';
import { attachRealtime, closeRealtime } from './src/realtime/hub.js';

// Opens the database file and applies the schema before the first request.
getDb();

const app = createApp();

const server = app.listen(PORT);

// Live bid updates share the HTTP server, so there is only one port to run.
attachRealtime(server);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try: PORT=4000 npm start`);
    closeDb();
    process.exit(1);
  }
  throw err;
});

server.on('listening', () => {
  // Windows can emit 'listening' just before an EADDRINUSE 'error'. Deferring
  // the message by one tick keeps a failed start from claiming success.
  setImmediate(() => {
    console.log(`BidderX running at http://${HOST}:${PORT}`);
  });
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    closeRealtime();
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  });
}
