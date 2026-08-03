/**
 * Shared WebSocket client.
 *
 * window.BidderXLive.connect(auctionId, handlers)
 *   auctionId - a number, or 'all' for the home page price feed
 *   handlers  - { onBid, onPrice, onStatus }
 *
 * Two things it takes care of:
 *   1. Reconnecting. If the server restarts or the network blips, it retries
 *      with a growing delay and re-subscribes automatically.
 *   2. Clock skew. The server sends its own time; we keep the difference and
 *      expose BidderXLive.now(), so every countdown agrees with the server
 *      even when the computer's clock is wrong.
 */
(function live() {
    'use strict';

    var RETRY_BASE_MS = 1000;
    var RETRY_MAX_MS = 15000;

    var clockOffsetMs = 0;
    var socket = null;
    var retryDelay = RETRY_BASE_MS;
    var retryTimer = null;
    var subscription = null;
    var callbacks = {};

    function socketUrl() {
        var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return protocol + '//' + window.location.host + '/ws';
    }

    function noteServerTime(serverNow) {
        if (typeof serverNow === 'number') {
            clockOffsetMs = serverNow - Date.now();
        }
    }

    function report(status) {
        if (typeof callbacks.onStatus === 'function') {
            callbacks.onStatus(status);
        }
    }

    function subscribe() {
        if (socket && socket.readyState === WebSocket.OPEN && subscription !== null) {
            socket.send(JSON.stringify({ type: 'subscribe', auctionId: subscription }));
        }
    }

    function scheduleReconnect() {
        if (retryTimer) {
            return;
        }

        retryTimer = window.setTimeout(function retry() {
            retryTimer = null;
            open();
        }, retryDelay);

        retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    }

    function handleMessage(event) {
        var message;

        try {
            message = JSON.parse(event.data);
        } catch (err) {
            return;
        }

        noteServerTime(message.serverNow);

        if (message.type === 'bid' && typeof callbacks.onBid === 'function') {
            callbacks.onBid(message);
        } else if (message.type === 'price' && typeof callbacks.onPrice === 'function') {
            callbacks.onPrice(message);
        } else if (message.type === 'closed' && typeof callbacks.onClosed === 'function') {
            callbacks.onClosed(message);
        }
    }

    function open() {
        try {
            socket = new WebSocket(socketUrl());
        } catch (err) {
            scheduleReconnect();
            return;
        }

        socket.addEventListener('open', function onOpen() {
            retryDelay = RETRY_BASE_MS;
            subscribe();
            report('live');
        });

        socket.addEventListener('message', handleMessage);

        socket.addEventListener('close', function onClose() {
            socket = null;
            report('offline');
            scheduleReconnect();
        });

        socket.addEventListener('error', function onError() {
            if (socket) {
                socket.close();
            }
        });
    }

    window.BidderXLive = {
        connect: function connect(auctionId, handlers) {
            subscription = auctionId;
            callbacks = handlers || {};
            open();
        },

        /** Server time, corrected for this machine's clock drift. */
        now: function now() {
            return Date.now() + clockOffsetMs;
        },
    };
})();
