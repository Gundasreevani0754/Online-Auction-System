import { createApp } from './src/app.js';
import { HOST, PORT } from './src/config.js';
import { closeDb, getDb } from './src/db/index.js';
import { attachRealtime, broadcastClose, closeRealtime } from './src/realtime/hub.js';
import { startAuctionCloser, stopAuctionCloser } from './src/auctions/closer.js';

// Opens the database file and applies the schema before the first request.
getDb();

const app = createApp();

const server = app.listen(PORT);

// Live bid updates share the HTTP server, so there is only one port to run.
attachRealtime(server);

// Ends auctions on schedule and tells everyone watching.
startAuctionCloser(broadcastClose);

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
    stopAuctionCloser();
    closeRealtime();
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  });
}
