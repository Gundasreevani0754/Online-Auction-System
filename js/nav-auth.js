/**
 * Swaps the home page's "Log In / Sign Up" buttons for a Dashboard link and a
 * Log Out button once a session exists. The signed-out markup stays exactly as
 * written in index.html, so nothing changes for visitors who are not signed in.
 */
(function navAuth() {
    'use strict';

    var actions = document.querySelector('.nav-actions');
    if (!actions) {
        return;
    }

    function signedInControls(user) {
        var dashboardLink = document.createElement('a');
        // Root-relative so it also works from /auction/:id, which is nested.
        dashboardLink.href = '/dashboard';
        dashboardLink.className = 'btn btn-secondary';
        dashboardLink.textContent = user.firstName;

        var logoutForm = document.createElement('form');
        logoutForm.action = '/logout';
        logoutForm.method = 'post';
        logoutForm.style.margin = '0';

        var logoutButton = document.createElement('button');
        logoutButton.type = 'submit';
        logoutButton.className = 'btn btn-primary';
        logoutButton.textContent = 'Log Out';
        logoutForm.appendChild(logoutButton);

        return [dashboardLink, logoutForm];
    }

    fetch('/api/me', { headers: { Accept: 'application/json' } })
        .then(function (response) {
            return response.ok ? response.json() : null;
        })
        .then(function (user) {
            if (!user) {
                return;
            }

            // Remove only the auth links, keeping the theme toggle in place.
            actions.querySelectorAll('a').forEach(function (link) {
                link.remove();
            });

            signedInControls(user).forEach(function (node) {
                actions.appendChild(node);
            });
        })
        .catch(function () {
            /* Offline or server down - leave the signed-out buttons as they are. */
        });
})();
