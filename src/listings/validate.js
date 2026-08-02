/**
 * Validation for the "list an item" form. Everything the seller types is
 * re-checked here - the browser's own checks are a convenience only.
 */

export const CATEGORIES = ['Women\'s Jewelry', 'Luxury Watches', 'Diamonds'];

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_IMAGE_URL_LENGTH = 500;
const MIN_STARTING_PRICE = 1;
const MAX_STARTING_PRICE = 100000000; // Rs 10 crore.
const MIN_DURATION_MS = 5 * 60 * 1000; // 5 minutes.
const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days.

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Only http(s) images are accepted. This is the important one: a
 * "javascript:" or "data:" URL placed in an <img src> is an XSS vector.
 */
function isSafeImageUrl(value) {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * @param {object} body
 * @returns {{ errors: string[], values: object }}
 */
export function validateListing(body) {
  const startingPriceRaw = asText(body.startingPrice);
  const endTimeRaw = asText(body.endTime);
  const endTimeMs = endTimeRaw ? new Date(endTimeRaw).getTime() : Number.NaN;

  const values = {
    title: asText(body.title),
    description: asText(body.description),
    category: asText(body.category),
    imageUrl: asText(body.imageUrl),
    startingPrice: Number(startingPriceRaw),
    endTime: Number.isNaN(endTimeMs) ? '' : new Date(endTimeMs).toISOString(),
  };

  const errors = [];

  if (!values.title) {
    errors.push('Item title is required.');
  } else if (values.title.length > MAX_TITLE_LENGTH) {
    errors.push(`Title must be under ${MAX_TITLE_LENGTH} characters.`);
  }

  if (!values.description) {
    errors.push('Description is required.');
  } else if (values.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`Description must be under ${MAX_DESCRIPTION_LENGTH} characters.`);
  }

  if (!CATEGORIES.includes(values.category)) {
    errors.push('Choose a category from the list.');
  }

  if (!values.imageUrl || values.imageUrl.length > MAX_IMAGE_URL_LENGTH) {
    errors.push('Photo URL is required.');
  } else if (!isSafeImageUrl(values.imageUrl)) {
    errors.push('Photo URL must start with http:// or https://');
  }

  if (!Number.isInteger(values.startingPrice)) {
    errors.push('Starting bid must be a whole number of rupees.');
  } else if (values.startingPrice < MIN_STARTING_PRICE || values.startingPrice > MAX_STARTING_PRICE) {
    errors.push(`Starting bid must be between ₹${MIN_STARTING_PRICE} and ₹${MAX_STARTING_PRICE.toLocaleString('en-IN')}.`);
  }

  if (!values.endTime) {
    errors.push('Choose when the auction ends.');
  } else {
    const duration = endTimeMs - Date.now();

    if (duration < MIN_DURATION_MS) {
      errors.push('End time must be at least 5 minutes from now.');
    } else if (duration > MAX_DURATION_MS) {
      errors.push('Auctions can run for at most 30 days.');
    }
  }

  return { errors, values };
}
