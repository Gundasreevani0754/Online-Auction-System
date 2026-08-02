/**
 * Listing form helpers: shows the server's error message, sets a sensible
 * default end time, and previews the photo URL before publishing.
 */
(function sellForm() {
    'use strict';

    var DEFAULT_DURATION_HOURS = 24;
    var MINUTES_PER_HOUR = 60;

    // ------------------------------------------------------------ error box

    var params = new URLSearchParams(window.location.search);
    var box = document.getElementById('form-error');
    var message = params.get('error');

    if (box && message) {
        box.textContent = message;
        box.style.display = 'block';
    }

    if (window.history.replaceState && window.location.search) {
        window.history.replaceState({}, '', window.location.pathname);
    }

    // ------------------------------------------------- end time constraints

    /** datetime-local needs "YYYY-MM-DDTHH:mm" in the browser's own timezone. */
    function toLocalInputValue(date) {
        var offsetMs = date.getTimezoneOffset() * MINUTES_PER_HOUR * 1000;
        return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
    }

    var endTime = document.getElementById('endTime');

    if (endTime) {
        var now = new Date();
        endTime.value = toLocalInputValue(new Date(now.getTime() + DEFAULT_DURATION_HOURS * 60 * 60 * 1000));
        endTime.min = toLocalInputValue(new Date(now.getTime() + 5 * 60 * 1000));
        endTime.max = toLocalInputValue(new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));
    }

    // --------------------------------------------------------- photo preview

    var imageUrl = document.getElementById('imageUrl');
    var preview = document.getElementById('image-preview');
    var previewWrapper = document.getElementById('image-preview-wrapper');

    function isHttpUrl(value) {
        return /^https?:\/\//i.test(value);
    }

    if (imageUrl && preview && previewWrapper) {
        imageUrl.addEventListener('change', function showPreview() {
            var value = imageUrl.value.trim();

            if (!isHttpUrl(value)) {
                previewWrapper.style.display = 'none';
                return;
            }

            preview.src = value;
            previewWrapper.style.display = 'block';
        });

        preview.addEventListener('error', function hideBrokenPreview() {
            previewWrapper.style.display = 'none';
        });
    }
})();
