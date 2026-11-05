'use strict';

const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scrypt = promisify(crypto.scrypt);

// scrypt parameters. They are stored alongside each hash so the format can be
// upgraded later without invalidating existing accounts.
const SCRYPT = Object.freeze({
  N: 16384,
  r: 8,
  p: 1,
  keyLength: 64,
  maxmem: 64 * 1024 * 1024,
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, SCRYPT.keyLength, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  });

  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64url'),
    derived.toString('base64url'),
  ].join('$');
}

async function verifyPassword(password, storedHash) {
  try {
    if (typeof password !== 'string' || typeof storedHash !== 'string') {
      return false;
    }

    const [algorithm, n, r, p, saltValue, hashValue] = storedHash.split('$');
    if (algorithm !== 'scrypt' || !saltValue || !hashValue) {
      return false;
    }

    const params = {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    };

    // Guard against malformed or hostile parameters in the database.
    if (
      !Number.isInteger(params.N) ||
      !Number.isInteger(params.r) ||
      !Number.isInteger(params.p) ||
      params.N < 1024 ||
      params.N > 131072 ||
      params.r < 1 ||
      params.r > 32 ||
      params.p < 1 ||
      params.p > 16
    ) {
      return false;
    }

    const salt = Buffer.from(saltValue, 'base64url');
    const expected = Buffer.from(hashValue, 'base64url');
    if (salt.length === 0 || expected.length === 0) {
      return false;
    }

    const derived = await scrypt(password, salt, expected.length, {
      ...params,
      maxmem: SCRYPT.maxmem,
    });

    return (
      derived.length === expected.length &&
      crypto.timingSafeEqual(derived, expected)
    );
  } catch {
    return false;
  }
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function isValidEmail(email) {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

function validateSignup({ name, email, password, confirmPassword }) {
  const errors = {};
  const cleanName = normalizeName(name);

  if (cleanName.length < 2) {
    errors.name = 'Enter your name (at least 2 characters).';
  } else if (cleanName.length > 60) {
    errors.name = 'Keep your name under 60 characters.';
  }

  if (!email) {
    errors.email = 'Enter your email address.';
  } else if (!isValidEmail(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Create a password.';
  } else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Keep your password under ${PASSWORD_MAX_LENGTH} characters.`;
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirm your password.';
  } else if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return {
    errors,
    values: {
      name: cleanName,
      email,
    },
  };
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
  PASSWORD_MIN_LENGTH,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  isValidEmail,
  normalizeEmail,
  normalizeName,
  validateSignup,
  verifyPassword,
};
