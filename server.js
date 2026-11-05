'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');

const auth = require('./src/auth');
const { openDatabase } = require('./src/db');
const {
  renderDashboard,
  renderError,
  renderLogin,
  renderSignup,
} = require('./src/views');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');

const PORT = parsePort(process.env.PORT, 3000);
const HOST = process.env.HOST || '127.0.0.1';
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(ROOT, 'data', 'login.db');
const SECURE_COOKIES = process.env.SECURE_COOKIES === '1';

const SESSION_COOKIE = 'login_sid';
const CSRF_COOKIE = 'login_csrf';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const CSRF_MAX_AGE_SECONDS = 24 * 60 * 60;
const MAX_BODY_BYTES = 16 * 1024;

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

const ASSETS = new Map([
  ['/assets/styles.css', { file: 'styles.css', type: 'text/css; charset=utf-8' }],
  ['/assets/app.js', { file: 'app.js', type: 'text/javascript; charset=utf-8' }],
  ['/assets/favicon.svg', { file: 'favicon.svg', type: 'image/svg+xml' }],
]);

const loginAttempts = new Map();

class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.headers = headers;
  }
}

function parsePort(value, fallback) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid PORT: ${value}`);
  }

  return parsed;
}

function applySecurityHeaders(res) {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data:",
      "font-src 'self'",
      "style-src 'self'",
      "script-src 'self'",
      "connect-src 'self'",
    ].join('; '),
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (SECURE_COOKIES) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function sendHtml(res, status, html, headers = {}) {
  const body = Buffer.from(html, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function sendJson(res, status, value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8');
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(303, {
    Location: location,
    'Cache-Control': 'no-store',
  });
  res.end();
}

function parseCookies(header) {
  const cookies = new Map();
  if (!header) {
    return cookies;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }

    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!name || cookies.has(name)) {
      continue;
    }

    try {
      cookies.set(name, decodeURIComponent(value));
    } catch {
      cookies.set(name, value);
    }
  }

  return cookies;
}

function sessionCookie(value, maxAge) {
  const attributes = [
    `${SESSION_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];

  if (SECURE_COOKIES) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

function csrfCookie(value) {
  const attributes = [
    `${CSRF_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${CSRF_MAX_AGE_SECONDS}`,
  ];

  if (SECURE_COOKIES) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

function issueCsrfToken(req, res) {
  const existing = parseCookies(req.headers.cookie).get(CSRF_COOKIE);
  if (existing && /^[A-Za-z0-9_-]{43}$/.test(existing)) {
    return existing;
  }

  const token = crypto.randomBytes(32).toString('base64url');
  res.setHeader('Set-Cookie', csrfCookie(token));
  return token;
}

function constantTimeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function assertValidCsrf(req, form) {
  const expected = parseCookies(req.headers.cookie).get(CSRF_COOKIE);
  const submitted = String(form._csrf ?? '');

  if (
    !expected ||
    !submitted ||
    expected.length !== 43 ||
    submitted.length !== 43 ||
    !constantTimeEqual(expected, submitted)
  ) {
    throw new HttpError(
      403,
      'Your form session expired. Refresh the page and try again.',
    );
  }
}

function readSession(req, db) {
  const token = parseCookies(req.headers.cookie).get(SESSION_COOKIE);
  if (!token || token.length > 128) {
    return null;
  }

  const user = db.findSession(auth.hashSessionToken(token));
  return user ? { token, user } : null;
}

function startSession(res, db, user) {
  const token = auth.createSessionToken();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;

  db.createSession({
    tokenHash: auth.hashSessionToken(token),
    userId: user.id,
    expiresAt,
  });

  res.setHeader('Set-Cookie', sessionCookie(token, SESSION_TTL_SECONDS));
  return expiresAt;
}

function endSession(req, res, db) {
  const token = parseCookies(req.headers.cookie).get(SESSION_COOKIE);

  if (token && token.length <= 128) {
    db.deleteSession(auth.hashSessionToken(token));
  }

  res.setHeader('Set-Cookie', sessionCookie('', 0));
}

function readForm(req) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (!contentType.startsWith('application/x-www-form-urlencoded')) {
      reject(new HttpError(415, 'Please submit the form normally.'));
      return;
    }

    let size = 0;
    let settled = false;
    const chunks = [];

    req.on('data', (chunk) => {
      if (settled) {
        return;
      }

      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        settled = true;
        reject(new HttpError(413, 'The submitted form was too large.'));
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) {
        return;
      }

      settled = true;
      const body = Buffer.concat(chunks).toString('utf8');
      const values = {};
      for (const [key, value] of new URLSearchParams(body)) {
        values[key] = value;
      }
      resolve(values);
    });

    req.on('error', (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

function hasValidOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) {
    return true;
  }

  const host = req.headers.host;
  if (!host) {
    return false;
  }

  // Some privacy-focused and embedded browsers serialize the origin as "null".
  // The CSRF token check below still protects those submissions.
  if (origin === 'null') {
    return true;
  }

  try {
    const parsed = new URL(origin);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.host === host
    );
  } catch {
    return false;
  }
}

function getClientIp(req) {
  return req.socket.remoteAddress || 'unknown';
}

function loginRetryAfter(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) {
    return 0;
  }

  const elapsed = Date.now() - entry.firstAttemptAt;
  if (elapsed >= LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return 0;
  }

  if (entry.failures < LOGIN_MAX_ATTEMPTS) {
    return 0;
  }

  return Math.max(1, Math.ceil((LOGIN_WINDOW_MS - elapsed) / 1000));
}

function recordLoginFailure(ip) {
  const now = Date.now();
  const existing = loginAttempts.get(ip);

  if (!existing || now - existing.firstAttemptAt >= LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { failures: 1, firstAttemptAt: now });
    return;
  }

  existing.failures += 1;
}

async function serveAsset(req, res, asset) {
  const filePath = path.join(PUBLIC_DIR, asset.file);
  const contents = await fs.readFile(filePath);

  res.writeHead(200, {
    'Content-Type': asset.type,
    'Content-Length': contents.length,
    'Cache-Control': 'public, max-age=300',
  });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  res.end(contents);
}

async function handleRequest(req, res, context) {
  applySecurityHeaders(res);

  try {
    const { db, dummyHash } = context;
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    const method = req.method || 'GET';

    if (pathname.startsWith('/assets/')) {
      const asset = ASSETS.get(pathname);
      if (!asset) {
        throw new HttpError(404, 'Asset not found.');
      }
      if (method !== 'GET' && method !== 'HEAD') {
        res.setHeader('Allow', 'GET, HEAD');
        throw new HttpError(405, 'That request method is not allowed.');
      }

      await serveAsset(req, res, asset);
      return;
    }

    if (method === 'POST') {
      if (!hasValidOrigin(req)) {
        throw new HttpError(403, 'This form submission could not be verified.');
      }

      const form = await readForm(req);
      assertValidCsrf(req, form);
      req.form = form;
    }

    if (method === 'GET' && pathname === '/health') {
      sendJson(res, 200, { status: 'ok', database: 'sqlite' });
      return;
    }

    if (method === 'GET' && pathname === '/') {
      const session = readSession(req, db);
      redirect(res, session ? '/dashboard' : '/login');
      return;
    }

    if (method === 'GET' && pathname === '/login') {
      if (readSession(req, db)) {
        redirect(res, '/dashboard');
        return;
      }

      sendHtml(
        res,
        200,
        renderLogin({
          csrfToken: issueCsrfToken(req, res),
          notice: url.searchParams.get('signed_out') === '1' ? 'signed_out' : '',
        }),
      );
      return;
    }

    if (method === 'POST' && pathname === '/login') {
      if (readSession(req, db)) {
        redirect(res, '/dashboard');
        return;
      }

      const ip = getClientIp(req);
      const retryAfter = loginRetryAfter(ip);
      if (retryAfter > 0) {
        sendHtml(
          res,
          429,
          renderError({
            status: 429,
            title: 'Too many attempts',
            message: 'For your security, sign-in is paused for a few minutes. Please try again shortly.',
          }),
          { 'Retry-After': String(retryAfter) },
        );
        return;
      }

      const form = req.form;
      const email = auth.normalizeEmail(form.email);
      const password = String(form.password ?? '');

      if (!email || !password) {
        sendHtml(
          res,
          400,
          renderLogin({
            csrfToken: issueCsrfToken(req, res),
            values: { email },
            error: 'Enter both your email address and password.',
          }),
        );
        return;
      }

      const user = db.findUserByEmail(email);
      let valid = false;

      if (user) {
        valid = await auth.verifyPassword(password, user.passwordHash);
      } else {
        // Keep the response time close to a real account lookup.
        await auth.verifyPassword(password, dummyHash);
      }

      if (!valid) {
        recordLoginFailure(ip);
        sendHtml(
          res,
          401,
          renderLogin({
            csrfToken: issueCsrfToken(req, res),
            values: { email },
            error: 'The email address or password is incorrect. Please try again.',
          }),
        );
        return;
      }

      loginAttempts.delete(ip);
      startSession(res, db, user);
      redirect(res, '/dashboard');
      return;
    }

    if (method === 'GET' && pathname === '/signup') {
      if (readSession(req, db)) {
        redirect(res, '/dashboard');
        return;
      }

      sendHtml(res, 200, renderSignup({ csrfToken: issueCsrfToken(req, res) }));
      return;
    }

    if (method === 'POST' && pathname === '/signup') {
      if (readSession(req, db)) {
        redirect(res, '/dashboard');
        return;
      }

      const form = req.form;
      const email = auth.normalizeEmail(form.email);
      const password = String(form.password ?? '');
      const confirmPassword = String(form.confirmPassword ?? '');
      const { errors, values } = auth.validateSignup({
        name: form.name,
        email,
        password,
        confirmPassword,
      });

      if (!errors.email && db.findUserByEmail(email)) {
        errors.email = 'An account with this email already exists. Try signing in instead.';
      }

      if (Object.keys(errors).length > 0) {
        sendHtml(
          res,
          422,
          renderSignup({
            csrfToken: issueCsrfToken(req, res),
            values,
            errors,
          }),
        );
        return;
      }

      const passwordHash = await auth.hashPassword(password);
      let user;

      try {
        user = db.createUser({
          name: values.name,
          email: values.email,
          passwordHash,
        });
      } catch (error) {
        if (String(error.code || '').includes('CONSTRAINT')) {
          sendHtml(
            res,
            409,
            renderSignup({
              csrfToken: issueCsrfToken(req, res),
              values,
              errors: { email: 'An account with this email already exists. Try signing in instead.' },
            }),
          );
          return;
        }
        throw error;
      }

      startSession(res, db, user);
      redirect(res, '/dashboard?created=1');
      return;
    }

    if (pathname === '/logout') {
      if (method !== 'POST') {
        res.setHeader('Allow', 'POST');
        throw new HttpError(405, 'Sign out using the button in your account.');
      }

      endSession(req, res, db);
      redirect(res, '/login?signed_out=1');
      return;
    }

    if (method === 'GET' && pathname === '/dashboard') {
      const session = readSession(req, db);
      if (!session) {
        redirect(res, '/login');
        return;
      }

      const sessionCount = db.countSessionsForUser(session.user.id);
      sendHtml(
        res,
        200,
        renderDashboard({
          csrfToken: issueCsrfToken(req, res),
          user: session.user,
          sessionCount,
          created: url.searchParams.get('created') === '1',
        }),
      );
      return;
    }

    const knownPaths = new Set(['/login', '/signup', '/dashboard', '/logout', '/']);
    if (knownPaths.has(pathname)) {
      const allowed = pathname === '/logout' ? 'POST' : 'GET';
      res.setHeader('Allow', allowed);
      throw new HttpError(405, 'That request method is not allowed.');
    }

    throw new HttpError(404, 'Page not found.');
  } catch (error) {
    if (res.headersSent) {
      res.destroy();
      return;
    }

    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) {
      console.error(error);
    }

    const titles = {
      400: 'Bad request',
      403: 'Request blocked',
      404: 'Page not found',
      405: 'Method not allowed',
      413: 'Request too large',
      415: 'Unsupported request',
      429: 'Too many attempts',
      500: 'Something went wrong',
    };

    sendHtml(
      res,
      status,
      renderError({
        status,
        title: titles[status] || 'Something went wrong',
        message:
          error instanceof HttpError
            ? error.message
            : 'An unexpected error occurred. Please try again.',
      }),
      error instanceof HttpError ? error.headers : {},
    );
  }
}

async function main() {
  const db = openDatabase(DB_PATH);
  db.cleanupSessions();

  // A throwaway hash used to keep unknown-email login timings consistent.
  const dummyHash = await auth.hashPassword(crypto.randomBytes(24).toString('hex'));

  const server = http.createServer((req, res) => {
    handleRequest(req, res, { db, dummyHash }).catch((error) => {
      console.error('Unhandled request error:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end('Internal server error');
    });
  });

  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;

  server.listen(PORT, HOST, () => {
    console.log(`Login system is running at http://${HOST}:${PORT}`);
    console.log(`SQLite database: ${DB_PATH}`);
  });

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of loginAttempts) {
      if (now - entry.firstAttemptAt >= LOGIN_WINDOW_MS) {
        loginAttempts.delete(ip);
      }
    }
    db.cleanupSessions();
  }, 10 * 60 * 1000);
  cleanupTimer.unref();

  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    console.log(`\nReceived ${signal}; shutting down.`);
    clearInterval(cleanupTimer);
    server.close(() => {
      db.close();
      process.exit(0);
    });
    server.closeAllConnections();

    setTimeout(() => process.exit(1), 5_000).unref();
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Failed to start login system:', error);
    process.exit(1);
  });
}

module.exports = { handleRequest };
