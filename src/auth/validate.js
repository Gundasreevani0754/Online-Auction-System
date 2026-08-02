/**
 * Server-side validation for the auth forms. The browser's own `required` and
 * `type="email"` checks are a convenience only - everything is re-checked here
 * because a client can always be bypassed.
 */

export const MIN_PASSWORD_LENGTH = 8;
const MAX_TEXT_LENGTH = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

export function normalizeEmail(value) {
  return asText(value).toLowerCase();
}

/**
 * @param {object} body
 * @returns {{ errors: string[], values: object }}
 */
export function validateRegistration(body) {
  const values = {
    firstName: asText(body.firstName),
    lastName: asText(body.lastName),
    email: normalizeEmail(body.email),
    phone: asText(body.phone),
    password: typeof body.password === 'string' ? body.password : '',
    confirmPassword: typeof body.confirmPassword === 'string' ? body.confirmPassword : '',
    // An unchecked checkbox is simply absent from the POST body.
    role: body.seller ? 'seller' : 'buyer',
  };

  const errors = [];

  if (!values.firstName || !values.lastName) {
    errors.push('First name and last name are required.');
  }
  if (values.firstName.length > MAX_TEXT_LENGTH || values.lastName.length > MAX_TEXT_LENGTH) {
    errors.push('Name is too long.');
  }
  if (!EMAIL_PATTERN.test(values.email)) {
    errors.push('Enter a valid email address.');
  }
  if (!values.phone) {
    errors.push('Phone number is required.');
  }
  if (values.password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (values.password !== values.confirmPassword) {
    errors.push('Passwords do not match.');
  }

  return { errors, values };
}

/**
 * @param {object} body
 * @returns {{ errors: string[], values: { email: string, password: string } }}
 */
export function validateLogin(body) {
  const values = {
    email: normalizeEmail(body.email),
    password: typeof body.password === 'string' ? body.password : '',
  };

  const errors = [];
  if (!values.email || !values.password) {
    errors.push('Enter your email and password.');
  }

  return { errors, values };
}
