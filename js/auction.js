/**
 * Auction detail page: photo, live price, bid form and full bid history.
 *
 * The server is the authority on every rule - this file only mirrors those
 * rules in the UI so the buttons make sense. A rejected bid always comes back
 * with the server's own message.
 *
 * All database values are written with textContent, never innerHTML.
 */
(function auctionPage() {
    'use strict';

    var MS_PER_SECOND = 1000;
    var MS_PER_MINUTE = 60 * MS_PER_SECOND;
    var MS_PER_HOUR = 60 * MS_PER_MINUTE;
    var MS_PER_DAY = 24 * MS_PER_HOUR;

    var container = document.getElementById('auction-detail');
    var messageBox = document.getElementById('auction-message');
    var auctionId = Number(window.location.pathname.split('/').pop());
    var countdownTimer = null;
    var countdownNode = null;
    var currentEndTime = null;
    var viewer = null;

    /** Live nodes updated in place when someone else bids. */
    var view = {};

    /** Server-corrected clock, falling back to local time before the socket opens. */
    function serverNow() {
        return window.BidderXLive ? window.BidderXLive.now() : Date.now();
    }

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

    function formatTimeLeft(endTime) {
        var remaining = new Date(endTime).getTime() - serverNow();
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
        var elapsed = serverNow() - new Date(isoDate).getTime();
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

    function notice(text, color) {
        var node = el('div', null, text);
        node.style.cssText =
            'padding: 0.9rem 1.2rem; border-radius: 12px; font-size: 0.9rem; margin-bottom: 1rem;' +
            'background: ' + color + '1F; border: 1px solid ' + color + '; color: ' + color + ';';
        return node;
    }

    // -------------------------------------------------------------- checkout

    /**
     * Simulated payment. No card details are collected - the button simply
     * confirms the amount and records the sale as settled.
     */
    function buildCheckout(state) {
        var wrapper = el('div');

        var error = el('div');
        error.setAttribute('role', 'alert');
        error.style.display = 'none';

        var summary = el('div');
        summary.style.cssText =
            'display: flex; justify-content: space-between; align-items: center;' +
            'padding: 0.9rem 0; margin-bottom: 0.5rem; border-top: 1px solid var(--glass-border);';
        summary.appendChild(el('span', 'bid-label', 'Amount payable'));
        summary.appendChild(el('span', 'bid-amount', money(state.payment.amount)));

        var pay = el('button', 'btn btn-primary btn-full', 'Complete Payment');
        pay.type = 'button';

        var note = el('p', null, 'Demonstration checkout - no card details are collected.');
        note.style.cssText = 'font-size: 0.8rem; color: var(--text-muted); text-align: center; margin-top: 0.75rem;';

        pay.addEventListener('click', function completePayment() {
            error.style.display = 'none';
            pay.disabled = true;
            pay.textContent = 'Processing…';

            fetch('/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ auctionId: state.auction.auctionId }),
            })
                .then(function (response) {
                    return response.json().then(function (body) {
                        return { ok: response.ok, body: body };
                    });
                })
                .then(function (result) {
                    if (!result.ok) {
                        error.textContent = result.body.error || 'Payment could not be completed.';
                        error.style.cssText =
                            'display: block; padding: 0.8rem 1rem; border-radius: 12px; margin-bottom: 1rem;' +
                            'background: rgba(239, 68, 68, 0.12); border: 1px solid var(--danger);' +
                            'color: var(--danger); font-size: 0.9rem;';
                        pay.disabled = false;
                        pay.textContent = 'Complete Payment';
                        return;
                    }

                    render({
                        auction: state.auction,
                        bids: view.lastBids,
                        viewer: viewer,
                        payment: result.body.payment,
                    });
                })
                .catch(function () {
                    error.textContent = 'Could not reach the server. Please try again.';
                    error.style.cssText =
                        'display: block; padding: 0.8rem 1rem; border-radius: 12px; margin-bottom: 1rem;' +
                        'background: rgba(239, 68, 68, 0.12); border: 1px solid var(--danger);' +
                        'color: var(--danger); font-size: 0.9rem;';
                    pay.disabled = false;
                    pay.textContent = 'Complete Payment';
                });
        });

        wrapper.appendChild(error);
        wrapper.appendChild(summary);
        wrapper.appendChild(pay);
        wrapper.appendChild(note);
        return wrapper;
    }

    // ------------------------------------------------------------- bid form

    function buildBidForm(state) {
        var auction = state.auction;
        var viewer = state.viewer;
        var wrapper = el('div');
        wrapper.style.marginTop = '1.5rem';

        if (!auction.isBiddable) {
            if (auction.winnerName && viewer && viewer.id === auction.winnerId) {
                var isPaid = state.payment && state.payment.status === 'paid';

                wrapper.appendChild(
                    notice(
                        isPaid
                            ? 'You won this auction at ' + money(auction.currentPrice) + '. Payment complete.'
                            : 'Congratulations - you won this auction at ' + money(auction.currentPrice) + '.',
                        '#22C55E',
                    ),
                );

                if (!isPaid && state.payment) {
                    wrapper.appendChild(buildCheckout(state));
                }
            } else if (auction.winnerName) {
                wrapper.appendChild(notice('This auction has ended. Won by ' + auction.winnerName + ' at ' + money(auction.currentPrice) + '.', '#94A3B8'));
            } else if (auction.status === 'closed') {
                wrapper.appendChild(notice('This auction ended with no bids.', '#94A3B8'));
            } else {
                wrapper.appendChild(notice('This auction has ended.', '#94A3B8'));
            }

            return wrapper;
        }

        if (!viewer) {
            var signIn = el('a', 'btn btn-primary btn-full', 'Log in to Bid');
            signIn.href = '/login';
            wrapper.appendChild(signIn);
            return wrapper;
        }

        if (viewer.isSeller) {
            wrapper.appendChild(notice('This is your listing. Sellers cannot bid on their own items.', '#F59E0B'));
            return wrapper;
        }

        var minimum = auction.bidCount === 0 ? auction.startingPrice : auction.currentPrice + 1;

        var error = el('div');
        error.setAttribute('role', 'alert');
        error.style.display = 'none';

        var label = el('label', 'form-label', 'Your Bid (minimum ' + money(minimum) + ')');
        label.setAttribute('for', 'bid-amount');
        view.minimumLabel = label;

        var input = el('input', 'form-control');
        input.type = 'number';
        input.id = 'bid-amount';
        input.name = 'amount';
        input.min = String(minimum);
        input.step = '1';
        input.required = true;
        input.value = String(minimum);
        view.input = input;

        // Once the bidder types their own figure we stop overwriting it when
        // someone else's bid arrives.
        input.addEventListener('input', function markTouched() {
            input.dataset.touched = 'true';
        });

        var submit = el('button', 'btn btn-primary btn-full', 'Place Bid');
        submit.type = 'submit';
        submit.style.marginTop = '1rem';

        var form = el('form');
        form.appendChild(error);
        form.appendChild(label);
        form.appendChild(input);
        form.appendChild(submit);

        form.addEventListener('submit', function submitBid(event) {
            event.preventDefault();
            error.style.display = 'none';
            submit.disabled = true;
            submit.textContent = 'Placing…';

            fetch('/bids', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ auctionId: auction.auctionId, amount: Number(input.value) }),
            })
                .then(function (response) {
                    return response.json().then(function (body) {
                        return { ok: response.ok, body: body };
                    });
                })
                .then(function (result) {
                    if (!result.ok) {
                        error.textContent = result.body.error || 'Your bid could not be placed.';
                        error.style.cssText =
                            'display: block; padding: 0.8rem 1rem; border-radius: 12px; margin-bottom: 1rem;' +
                            'background: rgba(239, 68, 68, 0.12); border: 1px solid var(--danger);' +
                            'color: var(--danger); font-size: 0.9rem;';
                        submit.disabled = false;
                        submit.textContent = 'Place Bid';
                        return;
                    }

                    render({
                        auction: result.body.auction,
                        bids: result.body.bids,
                        viewer: viewer,
                        justBid: true,
                        extended: result.body.extended,
                    });
                })
                .catch(function () {
                    error.textContent = 'Could not reach the server. Please try again.';
                    error.style.cssText =
                        'display: block; padding: 0.8rem 1rem; border-radius: 12px; margin-bottom: 1rem;' +
                        'background: rgba(239, 68, 68, 0.12); border: 1px solid var(--danger);' +
                        'color: var(--danger); font-size: 0.9rem;';
                    submit.disabled = false;
                    submit.textContent = 'Place Bid';
                });
        });

        wrapper.appendChild(form);
        return wrapper;
    }

    // ---------------------------------------------------------- bid history

    function buildHistory(bids, viewer) {
        var section = el('div');
        section.style.marginTop = '3rem';

        var heading = el('h2', null, 'Bid History');
        heading.style.cssText = 'font-size: 1.6rem; margin-bottom: 1.5rem;';
        section.appendChild(heading);

        if (bids.length === 0) {
            var empty = el('div', 'glass-card', 'No bids yet. Be the first to bid.');
            empty.style.cssText = 'padding: 2rem; text-align: center; color: var(--text-muted);';
            section.appendChild(empty);
            return section;
        }

        var list = el('div', 'glass-card');
        list.style.cssText = 'padding: 0.5rem 2rem;';

        bids.forEach(function (bid, index) {
            var row = el('div');
            row.style.cssText =
                'display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem 0;' +
                (index > 0 ? ' border-top: 1px solid var(--glass-border);' : '');

            var left = el('div');
            left.style.cssText = 'display: flex; align-items: center; gap: 0.7rem;';

            var who = el('span', null, viewer && bid.bidderId === viewer.id ? 'You' : bid.bidderName);
            who.style.fontWeight = '600';
            left.appendChild(who);

            if (index === 0) {
                var leading = el('span', null, 'Highest');
                leading.style.cssText =
                    'padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.7rem; font-weight: 600;' +
                    'background: rgba(34, 197, 94, 0.12); color: #22C55E;';
                left.appendChild(leading);
            }

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
            list.appendChild(row);
        });

        section.appendChild(list);
        return section;
    }

    // ---------------------------------------------------------------- layout

    function buildDetail(state) {
        var auction = state.auction;
        var layout = el('div');
        layout.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 2.5rem; align-items: start;';

        // Left: photo
        var photoCard = el('div', 'glass-card');
        photoCard.style.padding = '1rem';
        var imageWrapper = el('div', 'auction-img-wrapper');
        imageWrapper.style.height = '420px';
        var image = el('img', 'auction-img');
        image.src = auction.imageUrl;
        image.alt = auction.title;
        // A dead or hotlink-blocked photo URL falls back to a placeholder
        // rather than showing broken-image text.
        image.addEventListener('error', function useFallback() {
            if (image.src.indexOf('/images/placeholder.svg') === -1) {
                image.src = '/images/placeholder.svg';
            }
        });
        imageWrapper.appendChild(image);

        if (auction.isBiddable) {
            var live = el('div', 'live-badge');
            live.appendChild(el('div', 'live-dot'));
            live.appendChild(el('span', null, ' LIVE'));
            imageWrapper.appendChild(live);
        }

        var timer = el('div', 'countdown-timer');
        timer.appendChild(el('i', 'fa-regular fa-clock'));
        countdownNode = el('span', null, ' ' + formatTimeLeft(auction.endTime));
        currentEndTime = auction.endTime;
        timer.appendChild(countdownNode);
        imageWrapper.appendChild(timer);
        photoCard.appendChild(imageWrapper);

        // Right: details
        var infoCard = el('div', 'glass-card');

        if (state.justBid) {
            infoCard.appendChild(notice('Your bid was placed. You are the highest bidder.', '#22C55E'));
        }

        view.extensionSlot = el('div');
        infoCard.appendChild(view.extensionSlot);

        if (state.extended) {
            showExtensionNotice();
        }

        infoCard.appendChild(el('div', 'auction-category', auction.category));

        var title = el('h1', null, auction.title);
        title.style.cssText = 'font-size: 2rem; margin: 0.5rem 0 1rem;';
        infoCard.appendChild(title);

        var seller = el('div', 'seller-info');
        seller.style.marginBottom = '1.5rem';
        var avatar = el('img', 'seller-avatar');
        avatar.src = '/images/avatar.svg';
        avatar.alt = '';
        seller.appendChild(avatar);
        var sellerName = el('span', null, auction.sellerName + ' ');
        sellerName.appendChild(el('i', 'fa-solid fa-circle-check verified-icon'));
        seller.appendChild(sellerName);
        infoCard.appendChild(seller);

        var description = el('p', null, auction.description);
        description.style.cssText = 'color: var(--text-muted); line-height: 1.7; margin-bottom: 1.5rem;';
        infoCard.appendChild(description);

        var priceRow = el('div', 'bid-info');
        var current = el('div', 'current-bid');
        view.priceLabel = el('span', 'bid-label', auction.bidCount > 0 ? 'Current Highest Bid' : 'Starting Bid');
        view.price = el('span', 'bid-amount', money(auction.currentPrice));
        current.appendChild(view.priceLabel);
        current.appendChild(view.price);
        priceRow.appendChild(current);
        view.count = el('span', null, auction.bidCount + (auction.bidCount === 1 ? ' Bid' : ' Bids'));
        view.count.style.cssText = 'font-size: 0.85rem; color: var(--text-muted);';
        priceRow.appendChild(view.count);
        infoCard.appendChild(priceRow);

        infoCard.appendChild(buildBidForm(state));

        layout.appendChild(photoCard);
        layout.appendChild(infoCard);
        return layout;
    }

    function startCountdown() {
        if (countdownTimer) {
            window.clearInterval(countdownTimer);
        }

        countdownTimer = window.setInterval(function tick() {
            if (!countdownNode) {
                return;
            }
            countdownNode.textContent = ' ' + formatTimeLeft(currentEndTime);
        }, MS_PER_SECOND);
    }

    function render(state) {
        viewer = state.viewer;
        view = {};
        container.textContent = '';
        container.appendChild(buildDetail(state));
        view.history = buildHistory(state.bids, state.viewer);
        view.lastBids = state.bids;
        container.appendChild(view.history);
        document.title = state.auction.title + ' - BidderX';
        startCountdown();
    }

    /** Briefly highlights the price so a change is noticeable. */
    function flash(node) {
        node.style.transition = 'color 0.2s ease';
        node.style.color = 'var(--success)';
        window.setTimeout(function restore() {
            node.style.color = '';
        }, 1200);
    }

    /**
     * Applies someone else's bid without rebuilding the page, so a half-typed
     * amount is not thrown away.
     */
    /** Shown when a late bid pushes the finish line back. */
    function showExtensionNotice() {
        if (!view.extensionSlot) {
            return;
        }

        view.extensionSlot.textContent = '';
        view.extensionSlot.appendChild(
            notice('A late bid extended this auction by 2 minutes.', '#F59E0B'),
        );
    }

    function applyLiveUpdate(auction, bids, extended) {
        if (!view.price) {
            return;
        }

        if (extended) {
            showExtensionNotice();
        }

        view.price.textContent = money(auction.currentPrice);
        view.priceLabel.textContent = auction.bidCount > 0 ? 'Current Highest Bid' : 'Starting Bid';
        view.count.textContent = auction.bidCount + (auction.bidCount === 1 ? ' Bid' : ' Bids');
        flash(view.price);

        currentEndTime = auction.endTime;

        var replacement = buildHistory(bids, viewer);
        container.replaceChild(replacement, view.history);
        view.history = replacement;
        view.lastBids = bids;

        if (view.input) {
            var minimum = auction.currentPrice + 1;
            view.input.min = String(minimum);
            view.minimumLabel.textContent = 'Your Bid (minimum ' + money(minimum) + ')';

            if (view.input.dataset.touched !== 'true') {
                view.input.value = String(minimum);
            }
        }
    }

    function showMessage(text) {
        container.textContent = '';
        messageBox.textContent = text;
        messageBox.style.display = 'block';
    }

    fetch('/api/auctions/' + auctionId, { headers: { Accept: 'application/json' } })
        .then(function (response) {
            if (response.status === 404) {
                return null;
            }
            if (!response.ok) {
                throw new Error('Request failed with status ' + response.status);
            }
            return response.json();
        })
        .then(function (data) {
            if (!data) {
                showMessage('That auction could not be found.');
                return;
            }

            render(data);

            if (window.BidderXLive) {
                window.BidderXLive.connect(auctionId, {
                    onBid: function onBid(message) {
                        applyLiveUpdate(message.auction, message.bids, message.extended);
                    },
                    onClosed: function onClosed() {
                        // Refetch so the result carries the payment record the
                        // server has just created for the winner.
                        fetch('/api/auctions/' + auctionId, { headers: { Accept: 'application/json' } })
                            .then(function (response) {
                                return response.ok ? response.json() : null;
                            })
                            .then(function (fresh) {
                                if (fresh) {
                                    render(fresh);
                                }
                            })
                            .catch(function () {
                                /* Keep showing the last known state. */
                            });
                    },
                });
            }
        })
        .catch(function () {
            showMessage('Could not load this auction. Please refresh the page.');
        });
})();
