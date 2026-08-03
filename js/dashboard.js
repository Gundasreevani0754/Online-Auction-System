/**
 * Renders the dashboard from GET /api/dashboard.
 *
 * Every value coming from the database is written with textContent or set as
 * an attribute on an element created here - never through innerHTML - so an
 * item title typed by a seller can never inject markup.
 */
(function dashboard() {
    'use strict';

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_DAY = 24 * MS_PER_HOUR;

    var statsRow = document.getElementById('stats-row');
    var sections = document.getElementById('dashboard-sections');
    var messageBox = document.getElementById('dashboard-message');
    var countdownTargets = [];

    // ---------------------------------------------------------------- helpers

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

    /** "1d 05:40:00" while running, "Ended" once the end time passes. */
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

    function timeAgo(isoDate) {
        var elapsed = Date.now() - new Date(isoDate).getTime();
        if (elapsed < MS_PER_MINUTE) {
            return 'just now';
        }
        if (elapsed < MS_PER_HOUR) {
            return Math.floor(elapsed / MS_PER_MINUTE) + 'm ago';
        }
        if (elapsed < MS_PER_DAY) {
            return Math.floor(elapsed / MS_PER_HOUR) + 'h ago';
        }
        return Math.floor(elapsed / MS_PER_DAY) + 'd ago';
    }

    function pill(text, color) {
        var node = el('span', null, text);
        node.style.cssText =
            'padding: 0.25rem 0.7rem; border-radius: 20px; font-size: 0.75rem; font-weight: 600;' +
            'background: ' + color + '1F; color: ' + color + ';';
        return node;
    }

    function sectionHeading(text) {
        var heading = el('h2', null, text);
        heading.style.cssText = 'font-size: 1.6rem; margin-bottom: 1.5rem;';
        return heading;
    }

    function emptyState(text) {
        var node = el('div', 'glass-card', text);
        node.style.cssText = 'padding: 2rem; text-align: center; color: var(--text-muted); margin-bottom: 3rem;';
        return node;
    }

    // ------------------------------------------------------------- components

    function statCard(stat) {
        var card = el('div', 'glass-card');
        card.style.textAlign = 'center';

        var value = el('h2', 'text-gradient', stat.value);
        value.style.marginBottom = '0.25rem';

        var label = el('div', null, stat.label);
        label.style.cssText = 'font-size: 0.9rem; color: var(--text-muted);';

        card.appendChild(value);
        card.appendChild(label);
        return card;
    }

    /** The auction card shape used across the site: image, meta, price row. */
    function auctionCard(auction, extras) {
        var card = el('div', 'glass-card auction-card slide-up');

        var imageWrapper = el('div', 'auction-img-wrapper');
        var image = el('img', 'auction-img');
        image.src = auction.imageUrl;
        image.alt = auction.title;
        image.loading = 'lazy';
        imageWrapper.appendChild(image);

        if (auction.status === 'open') {
            var timer = el('div', 'countdown-timer');
            var clock = el('i', 'fa-regular fa-clock');
            timer.appendChild(clock);
            var timerText = el('span', null, ' ' + formatTimeLeft(auction.endTime));
            timer.appendChild(timerText);
            countdownTargets.push({ node: timerText, endTime: auction.endTime });
            imageWrapper.appendChild(timer);
        }

        var info = el('div', 'auction-info');
        info.appendChild(el('div', 'auction-category', auction.category));
        info.appendChild(el('div', 'auction-title', auction.title));

        if (auction.sellerName) {
            var seller = el('div', 'seller-info');
            seller.appendChild(el('span', null, auction.sellerName));
            info.appendChild(seller);
        }

        var bidInfo = el('div', 'bid-info');
        var currentBid = el('div', 'current-bid');
        currentBid.appendChild(el('span', 'bid-label', extras && extras.priceLabel ? extras.priceLabel : 'Current Bid'));
        currentBid.appendChild(el('span', 'bid-amount', money(auction.currentPrice)));
        bidInfo.appendChild(currentBid);

        var count = el('span', null, auction.bidCount + (auction.bidCount === 1 ? ' Bid' : ' Bids'));
        count.style.cssText = 'font-size: 0.8rem; color: var(--text-muted);';
        bidInfo.appendChild(count);
        info.appendChild(bidInfo);

        if (extras && extras.footer) {
            info.appendChild(extras.footer);
        }

        var open = el('a', 'btn btn-secondary', 'View Auction');
        open.href = '/auction/' + auction.auctionId;
        open.style.cssText = 'width: 100%; border-radius: 12px; margin-top: 0.75rem;';
        info.appendChild(open);

        card.appendChild(imageWrapper);
        card.appendChild(info);
        return card;
    }

    function myBidFooter(bid) {
        var footer = el('div');
        footer.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-top: 0.75rem;';

        var mine = el('span');
        mine.style.cssText = 'font-size: 0.85rem; color: var(--text-muted);';
        mine.appendChild(el('span', null, 'Your bid: '));
        var amount = el('strong', null, money(bid.myBid));
        amount.style.color = 'var(--text-color)';
        mine.appendChild(amount);

        footer.appendChild(mine);
        footer.appendChild(
            bid.status !== 'open'
                ? pill('Closed', '#94A3B8')
                : bid.isWinning
                    ? pill('Winning', '#22C55E')
                    : pill('Outbid', '#EF4444'),
        );

        return footer;
    }

    function listingFooter(listing) {
        var footer = el('div');
        footer.style.cssText = 'margin-top: 0.75rem;';

        if (listing.status === 'open') {
            footer.appendChild(pill('Live', '#22C55E'));
        } else if (listing.paymentStatus === 'paid') {
            footer.appendChild(pill('Sold · Paid', '#22C55E'));
        } else if (listing.winnerId) {
            footer.appendChild(pill('Sold · Awaiting payment', '#F59E0B'));
        } else {
            footer.appendChild(pill('Unsold', '#94A3B8'));
        }

        return footer;
    }

    /** A card for an auction this buyer won, with its payment state. */
    function winCard(win) {
        var footer = el('div');
        footer.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-top: 0.75rem;';

        var seller = el('span', null, win.sellerName);
        seller.style.cssText = 'font-size: 0.85rem; color: var(--text-muted);';
        footer.appendChild(seller);
        footer.appendChild(
            win.paymentStatus === 'paid' ? pill('Paid', '#22C55E') : pill('Payment due', '#F59E0B'),
        );

        var card = auctionCard(
            {
                auctionId: win.auctionId,
                title: win.title,
                category: win.category,
                imageUrl: win.imageUrl,
                currentPrice: win.amount,
                bidCount: win.bidCount,
                endTime: win.endTime,
                status: 'closed',
            },
            { footer: footer, priceLabel: 'Winning Bid' },
        );

        return card;
    }

    function bidsReceivedList(bids) {
        var wrapper = el('div', 'glass-card');
        wrapper.style.cssText = 'padding: 0.5rem 2rem; margin-bottom: 3rem;';

        bids.forEach(function (bid, index) {
            var row = el('div');
            row.style.cssText =
                'display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1.1rem 0;' +
                (index > 0 ? ' border-top: 1px solid var(--glass-border);' : '');

            var left = el('div');
            var who = el('div', null, bid.bidderName);
            who.style.fontWeight = '600';
            var what = el('div', null, bid.title);
            what.style.cssText = 'font-size: 0.85rem; color: var(--text-muted);';
            left.appendChild(who);
            left.appendChild(what);

            var right = el('div');
            right.style.textAlign = 'right';
            var amount = el('div', 'bid-amount', money(bid.amount));
            amount.style.fontSize = '1.1rem';
            var when = el('div', null, timeAgo(bid.placedAt));
            when.style.cssText = 'font-size: 0.8rem; color: var(--text-muted);';
            right.appendChild(amount);
            right.appendChild(when);

            row.appendChild(left);
            row.appendChild(right);
            wrapper.appendChild(row);
        });

        return wrapper;
    }

    function grid(cards) {
        var node = el('div', 'auctions-grid');
        cards.forEach(function (card) {
            node.appendChild(card);
        });
        return node;
    }

    // ------------------------------------------------------------------ views

    function renderBuyer(data) {
        var wins = data.wins || [];

        // Won auctions come first - an unpaid one needs the buyer's attention.
        if (wins.length > 0) {
            sections.appendChild(sectionHeading('Auctions You Won'));
            sections.appendChild(grid(wins.map(winCard)));
        }

        sections.appendChild(sectionHeading('My Bids'));
        sections.appendChild(
            data.myBids.length > 0
                ? grid(data.myBids.map(function (bid) {
                    return auctionCard(bid, { footer: myBidFooter(bid) });
                }))
                : emptyState('You have not placed any bids yet.'),
        );

        sections.appendChild(sectionHeading('Live Auctions'));
        sections.appendChild(
            data.liveAuctions.length > 0
                ? grid(data.liveAuctions.map(function (auction) {
                    return auctionCard(auction);
                }))
                : emptyState('No auctions are running right now.'),
        );
    }

    function renderSeller(data) {
        sections.appendChild(sectionHeading('My Listings'));
        sections.appendChild(
            data.myListings.length > 0
                ? grid(data.myListings.map(function (listing) {
                    return auctionCard(listing, { footer: listingFooter(listing) });
                }))
                : emptyState('You have not listed any items yet.'),
        );

        sections.appendChild(sectionHeading('Bids Received'));
        sections.appendChild(
            data.bidsReceived.length > 0
                ? bidsReceivedList(data.bidsReceived)
                : emptyState('No bids on your items yet.'),
        );
    }

    /** Confirmation shown after a listing is published. */
    function showListedBanner(title) {
        var banner = el('div', null);
        banner.setAttribute('role', 'status');
        banner.style.cssText =
            'margin-bottom: 2rem; padding: 0.9rem 1.2rem; border-radius: 12px; font-size: 0.95rem;' +
            'background: rgba(34, 197, 94, 0.12); border: 1px solid #22C55E; color: #16A34A;';
        banner.appendChild(el('strong', null, title));
        banner.appendChild(el('span', null, ' is now live. Buyers can start bidding on it.'));

        var subtitle = document.getElementById('greeting-subtitle');
        subtitle.parentNode.parentNode.insertBefore(banner, subtitle.parentNode.nextSibling);
    }

    function listItemButton() {
        var link = el('a', 'btn btn-primary', 'List an Item');
        link.href = 'sell.html';
        link.style.marginTop = '1.25rem';
        link.appendChild(el('i', 'fa-solid fa-plus'));
        return link;
    }

    function render(data) {
        var isSeller = data.user.role === 'seller';

        document.getElementById('greeting-name').textContent = data.user.firstName;
        document.getElementById('nav-user-name').textContent = data.user.firstName;
        document.getElementById('greeting-subtitle').textContent = isSeller
            ? 'Here is how your listings are performing.'
            : 'Here is where your bids stand right now.';

        if (isSeller) {
            document.getElementById('greeting-subtitle').parentNode.appendChild(listItemButton());
        }

        var listed = new URLSearchParams(window.location.search).get('listed');
        if (listed) {
            showListedBanner(listed);
            if (window.history.replaceState) {
                window.history.replaceState({}, '', window.location.pathname);
            }
        }

        data.stats.forEach(function (stat) {
            statsRow.appendChild(statCard(stat));
        });

        if (isSeller) {
            renderSeller(data);
        } else {
            renderBuyer(data);
        }

        window.setInterval(function () {
            countdownTargets.forEach(function (target) {
                target.node.textContent = ' ' + formatTimeLeft(target.endTime);
            });
        }, MS_PER_SECOND);
    }

    function showMessage(text) {
        messageBox.textContent = text;
        messageBox.style.display = 'block';
    }

    fetch('/api/dashboard', { headers: { Accept: 'application/json' } })
        .then(function (response) {
            if (response.status === 401) {
                window.location.replace('/login');
                return null;
            }
            if (!response.ok) {
                throw new Error('Request failed with status ' + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            if (data) {
                render(data);
            }
        })
        .catch(function () {
            showMessage('Could not load your dashboard. Please refresh the page.');
        });
})();
