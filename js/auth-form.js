/**
 * Shows the message the server sent back on a failed login or registration,
 * and restores the email so it does not have to be typed again.
 *
 * Values are written with textContent / input.value, never innerHTML, so a
 * crafted ?error= in the URL cannot inject markup.
 */
(function displayAuthFormFeedback() {
    var params = new URLSearchParams(window.location.search);
    var box = document.getElementById('form-error');
    var message = params.get('error');

    if (box && message) {
        box.textContent = message;
        box.style.display = 'block';
    }

    var email = params.get('email');
    var emailInput = document.querySelector('input[name="email"]');

    if (email && emailInput) {
        emailInput.value = email;
    }

    // Drops the query string so a refresh does not re-show a stale error.
    if (window.history.replaceState && window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
    }
})();
