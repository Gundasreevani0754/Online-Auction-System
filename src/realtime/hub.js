import { WebSocketServer } from 'ws';

/**
 * Live bid updates over a real WebSocket.
 *
 * Clients connect to /ws and send { type: 'subscribe', auctionId } - or
 * auctionId: 'all' from the home page, which only wants price changes. When a
 * bid is accepted the route calls broadcastBid() and everyone watching that
 * auction is updated without polling or refreshing.
 *
 * The server also publishes its own clock. Each client stores the difference
 * between server time and its own, so every countdown on every machine agrees
 * with the server even if the laptop's clock is wrong.
 */

const ALL_ROOM = 'all';
const TIME_SYNC_INTERVAL_MS = 15000;
const HEARTBEAT_INTERVAL_MS = 30000;

/** room key -> Set of sockets */
const rooms = new Map();
let wss = null;
let timers = [];

function roomKey(auctionId) {
  return auctionId === ALL_ROOM ? ALL_ROOM : `auction:${auctionId}`;
}

function join(socket, key) {
  leave(socket);

  if (!rooms.has(key)) {
    rooms.set(key, new Set());
  }

  rooms.get(key).add(socket);
  socket.roomKey = key;
}

function leave(socket) {
  if (!socket.roomKey) {
    return;
  }

  const room = rooms.get(socket.roomKey);

  if (room) {
    room.delete(socket);
    if (room.size === 0) {
      rooms.delete(socket.roomKey);
    }
  }

  socket.roomKey = null;
}

function send(socket, payload) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function sendToRoom(key, payload) {
  const room = rooms.get(key);

  if (!room) {
    return 0;
  }

  const message = JSON.stringify(payload);
  let delivered = 0;

  for (const socket of room) {
    if (socket.readyState === socket.OPEN) {
      socket.send(message);
      delivered += 1;
    }
  }

  return delivered;
}

function handleMessage(socket, raw) {
  let message;

  try {
    message = JSON.parse(raw);
  } catch {
    return; // Ignore anything that is not JSON.
  }

  if (message.type !== 'subscribe') {
    return;
  }

  const auctionId =
    message.auctionId === ALL_ROOM ? ALL_ROOM : Number(message.auctionId);

  if (auctionId !== ALL_ROOM && !Number.isInteger(auctionId)) {
    return;
  }

  join(socket, roomKey(auctionId));
  send(socket, { type: 'subscribed', auctionId, serverNow: Date.now() });
}

/**
 * Attaches the WebSocket server to the running HTTP server.
 *
 * @param {import('node:http').Server} server
 */
export function attachRealtime(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (socket) => {
    socket.isAlive = true;
    socket.roomKey = null;

    socket.on('pong', () => {
      socket.isAlive = true;
    });
    socket.on('message', (raw) => handleMessage(socket, raw));
    socket.on('close', () => leave(socket));
    socket.on('error', () => leave(socket));

    send(socket, { type: 'hello', serverNow: Date.now() });
  });

  // Keeps every client's countdown anchored to the server's clock.
  const timeSync = setInterval(() => {
    for (const socket of wss.clients) {
      send(socket, { type: 'time', serverNow: Date.now() });
    }
  }, TIME_SYNC_INTERVAL_MS);

  // Drops connections that died without a close frame.
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  timers = [timeSync, heartbeat];

  return wss;
}

/**
 * Pushes an accepted bid to everyone watching that auction, and the new price
 * to the home page.
 *
 * @param {{ auction: object, bids: object[] }} update
 */
export function broadcastBid({ auction, bids, extended = false }) {
  const serverNow = Date.now();

  sendToRoom(roomKey(auction.auctionId), { type: 'bid', auction, bids, extended, serverNow });
  sendToRoom(ALL_ROOM, {
    type: 'price',
    auctionId: auction.auctionId,
    currentPrice: auction.currentPrice,
    bidCount: auction.bidCount,
    serverNow,
  });
}

/**
 * Announces that an auction has finished, so open pages switch to the result
 * without anyone refreshing.
 *
 * @param {object} auction
 */
export function broadcastClose(auction) {
  const serverNow = Date.now();

  sendToRoom(roomKey(auction.auctionId), { type: 'closed', auction, serverNow });
  sendToRoom(ALL_ROOM, { type: 'closed', auctionId: auction.auctionId, serverNow });
}

export function closeRealtime() {
  timers.forEach(clearInterval);
  timers = [];
  rooms.clear();

  if (wss) {
    wss.close();
    wss = null;
  }
}

/** Exposed for the tests below the surface: how many sockets are watching. */
export function viewerCount(auctionId) {
  return rooms.get(roomKey(auctionId))?.size ?? 0;
}
