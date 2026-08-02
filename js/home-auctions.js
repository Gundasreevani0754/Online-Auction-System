/**
 * Replaces the hard-coded cards in the "Trending Collections" grid with the
 * live auctions from the database, so a newly published listing shows up on
 * the home page without anyone editing index.html.
 *
 * The markup written here mirrors the original cards exactly. If the request
 * fails the existing static cards are left alone.
 *
 * Every database value goes in through textContent or a property on an element
 * created here - never innerHTML - so a seller cannot inject markup.
 */
(function homeAuctions() {
    'use strict';

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_DAY = 24 * MS_PER_HOUR;

    var grid = document.querySelector('.auctions-grid');
    if (!grid) {
        return;
    }

    var countdowns = [];
    var isSignedIn = false;

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) {
            node.className = className;
        }
        if (text !== undefined && text !== null) {
            node.textContent = String(text);
        }
        return node;
    }

    function money(amount) {
        return '₹' + Number(amount || 0).toLocaleString('en-IN');
    }

    function pad(value) {
        return String(value).padStart(2, '0');
    }

    function formatTimeLeft(endTime) {
        var remaining = new Date(endTime).getTime() - Date.now();
        if (!isFinite(remaining) || remaining <= 0) {
            return 'Ended';
        }

        var days = Math.floor(remaining / MS_PER_DAY);
        var hours = Math.floor((remaining % MS_PER_DAY) / MS_PER_HOUR);
        var minutes = Math.floor((remaining % MS_PER_HOUR) / MS_PER_MINUTE);
        var seconds = Math.floor((remaining % MS_PER_MINUTE) / MS_PER_SECOND);

        return (days > 0 ? days + 'd ' : '') + pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
    }

    function buildCard(auction, index) {
        var card = el('div', 'glass-card auction-card slide-up');
        card.style.animationDelay = (0.1 * (index + 1)).toFixed(1) + 's';

        var imageWrapper = el('div', 'auction-img-wrapper');
        var image = el('img', 'auction-img');
        image.src = auction.imageUrl;
        image.alt = auction.title;
        image.loading = 'lazy';
        imageWrapper.appendChild(image);

        var watchlist = el('button', 'watchlist-btn');
        watchlist.type = 'button';
        watchlist.setAttribute('aria-label', 'Add to watchlist');
        watchlist.appendChild(el('i', 'fa-regular fa-heart'));
        imageWrapper.appendChild(watchlist);

        var timer = el('div', 'countdown-timer');
        timer.appendChild(el('i', 'fa-regular fa-clock'));
        var timerText = el('span', null, ' ' + formatTimeLeft(auction.endTime));
        timer.appendChild(timerText);
        countdowns.push({ node: timerText, endTime: auction.endTime });
        imageWrapper.appendChild(timer);

        var info = el('div', 'auction-info');
        info.appendChild(el('div', 'auction-category', auction.category));
        info.appendChild(el('div', 'auction-title', auction.title));

        var seller = el('div', 'seller-info');
        var avatar = el('img', 'seller-avatar');
        avatar.src = 'https://i.pravatar.cc/100?img=' + auction.sellerId;
        avatar.alt = '';
        seller.appendChild(avatar);
        var sellerName = el('span', null, auction.sellerName + ' ');
        sellerName.appendChild(el('i', 'fa-solid fa-circle-check verified-icon'));
        seller.appendChild(sellerName);
        info.appendChild(seller);

        var bidInfo = el('div', 'bid-info');
        var currentBid = el('div', 'current-bid');
        currentBid.appendChild(el('span', 'bid-label', auction.bidCount > 0 ? 'Current Bid' : 'Starting Bid'));
        currentBid.appendChild(el('span', 'bid-amount', money(auction.currentPrice)));
        bidInfo.appendChild(currentBid);

        var count = el('span', null, auction.bidCount + (auction.bidCount === 1 ? ' Bid' : ' Bids'));
        count.style.cssText = 'font-size: 0.8rem; color: var(--text-muted);';
        bidInfo.appendChild(count);
        info.appendChild(bidInfo);

        // Signed-out visitors keep the original "Login to Bid" wording; the
        // auction page itself is public either way.
        var action = el('a', 'btn btn-primary', isSignedIn ? 'Place Bid' : 'Login to Bid');
        action.href = '/auction/' + auction.auctionId;
        action.style.cssText = 'width: 100%; border-radius: 12px;';
        info.appendChild(action);

        card.appendChild(imageWrapper);
        card.appendChild(info);
        return card;
    }

    Promise.all([
        fetch('/api/auctions', { headers: { Accept: 'application/json' } }),
        fetch('/api/me', { headers: { Accept: 'application/json' } }),
    ])
        .then(function (responses) {
            isSignedIn = responses[1].ok;
            return responses[0].ok ? responses[0].json() : null;
        })
        .then(function (data) {
            if (!data || !Array.isArray(data.auctions) || data.auctions.length === 0) {
                return;
            }

            grid.textContent = '';
            data.auctions.forEach(function (auction, index) {
                grid.appendChild(buildCard(auction, index));
            });

            window.setInterval(function () {
                countdowns.forEach(function (target) {
                    target.node.textContent = ' ' + formatTimeLeft(target.endTime);
                });
            }, MS_PER_SECOND);
        })
        .catch(function () {
            /* Leave the static cards in place if the feed cannot be reached. */
        });
})();
