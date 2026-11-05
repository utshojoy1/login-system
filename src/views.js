'use strict';

const BRAND_NAME = 'Account';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function initialsFor(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return 'K';
  }

  const first = Array.from(parts[0])[0] || '';
  const last = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] || '' : '';
  return `${first}${last}`.toUpperCase();
}

function firstNameFor(name) {
  return String(name || '').trim().split(/\s+/)[0] || 'there';
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(date);
}

function brandMark(className = '') {
  return `
    <svg class="brand-mark ${className}" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M20 4.5 24.9 15.1 35.5 20l-10.6 4.9L20 35.5l-4.9-10.6L4.5 20l10.6-4.9L20 4.5Z" fill="currentColor"/>
      <circle cx="20" cy="20" r="3.4" fill="var(--mark-cutout, #0d211b)"/>
    </svg>
  `;
}

function icon(name, className = '') {
  const paths = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>',
    database:
      '<ellipse cx="12" cy="5" rx="7.5" ry="3"/><path d="M4.5 5v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V5"/><path d="M4.5 11v6c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-6"/>',
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/>',
    eyeOff:
      '<path d="m3 3 18 18"/><path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6 0 9.5 6 9.5 6a15.6 15.6 0 0 1-3.1 3.6"/><path d="M6.2 6.7A15.9 15.9 0 0 0 2.5 12s3.5 6 9.5 6a9.7 9.7 0 0 0 4.2-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    lock:
      '<rect x="5" y="10" width="14" height="10" rx="2.5"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/><path d="M12 14v2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
    shield:
      '<path d="M12 2.8 20 6v5.6c0 4.8-3.2 8.1-8 9.6-4.8-1.5-8-4.8-8-9.6V6l8-3.2Z"/><path d="m8.5 12 2.4 2.4 4.8-5"/>',
    signout:
      '<path d="M14 5H6.5A2.5 2.5 0 0 0 4 7.5v9A2.5 2.5 0 0 0 6.5 19H14"/><path d="M17 8l4 4-4 4"/><path d="M21 12H9"/>',
    spark: '<path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z"/>',
    user: '<circle cx="12" cy="8" r="3.5"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  };

  return `
    <svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      ${paths[name] || ''}
    </svg>
  `;
}

function alert(type, title, message) {
  const iconName = type === 'error' ? 'shield' : 'check';
  return `
    <div class="alert alert--${escapeHtml(type)}" role="${type === 'error' ? 'alert' : 'status'}">
      <span class="alert__icon">${icon(iconName)}</span>
      <div class="alert__copy">
        <strong>${escapeHtml(title)}</strong>
        ${message ? `<span>${escapeHtml(message)}</span>` : ''}
      </div>
    </div>
  `;
}

function fieldError(errors, key) {
  if (!errors[key]) {
    return '';
  }

  return `<p class="field-error" id="${escapeHtml(key)}-error">${escapeHtml(errors[key])}</p>`;
}

function fieldState(errors, key) {
  if (!errors[key]) {
    return {
      className: '',
      ariaInvalid: '',
      describedBy: '',
    };
  }

  return {
    className: ' input--error',
    ariaInvalid: ' aria-invalid="true"',
    describedBy: ` aria-describedby="${escapeHtml(key)}-error"`,
  };
}

function documentShell({ title, description, bodyClass, content }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${escapeHtml(description)}">
    <meta name="theme-color" content="#0d211b">
    <title>${escapeHtml(title)}</title>
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/assets/styles.css">
    <script src="/assets/app.js" defer></script>
  </head>
  <body class="${escapeHtml(bodyClass)}">
    <a class="skip-link" href="#main">Skip to content</a>
    ${content}
  </body>
</html>`;
}

function brandPanel() {
  return `
    <aside class="brand-panel">
      <div class="brand-panel__grid" aria-hidden="true"></div>
      <div class="brand-panel__orb" aria-hidden="true"></div>

      <a class="brand brand--light" href="/" aria-label="${BRAND_NAME} home">
        <span class="brand__mark-wrap">${brandMark()}</span>
        <span class="brand__name">${BRAND_NAME}</span>
      </a>

      <div class="brand-copy">
        <p class="eyebrow eyebrow--light"><span></span>Simple by design</p>
        <h1>One account.<br><em>Everything</em> in place.</h1>
        <p class="brand-copy__lede">
          A calm, secure home for your account — built with plain SQL,
          strong password hashing, and no unnecessary moving parts.
        </p>
      </div>

      <ul class="proof-list" aria-label="Security highlights">
        <li>
          <span class="proof-list__icon">${icon('shield')}</span>
          <span><strong>Protected by default</strong><small>Passwords are salted and hashed.</small></span>
        </li>
        <li>
          <span class="proof-list__icon">${icon('database')}</span>
          <span><strong>Built on SQL</strong><small>Users and sessions live in SQLite.</small></span>
        </li>
        <li>
          <span class="proof-list__icon">${icon('lock')}</span>
          <span><strong>Private sessions</strong><small>HttpOnly cookies, never tokens in URLs.</small></span>
        </li>
      </ul>

      <div class="brand-footer">
        <span class="status-dot"></span>
        <span>Local-first account system</span>
        <span class="brand-footer__rule"></span>
        <span>v1.0</span>
      </div>
    </aside>
  `;
}

function authLayout({ title, description, card }) {
  return documentShell({
    title,
    description,
    bodyClass: 'page-auth',
    content: `
      <main class="auth-shell" id="main">
        ${brandPanel()}
        <section class="form-panel">
          <div class="form-panel__top">
            <a class="mobile-brand" href="/" aria-label="${BRAND_NAME} home">
              ${brandMark()}
              <span>${BRAND_NAME}</span>
            </a>
            <span class="form-panel__meta">${icon('lock')} Secure sign-in</span>
          </div>
          ${card}
          <p class="form-panel__legal">By continuing, you agree to keep your account details private.</p>
        </section>
      </main>
    `,
  });
}

function renderLogin({ values = {}, error = '', notice = '', csrfToken = '' } = {}) {
  const email = values.email || '';
  const errorBlock = error
    ? alert('error', 'We could not sign you in', error)
    : '';
  const noticeBlock =
    notice === 'signed_out'
      ? alert('success', 'Signed out safely', 'Your session was removed from the database.')
      : '';

  const card = `
    <div class="auth-card">
      <p class="eyebrow eyebrow--dark">Welcome back</p>
      <h2>Sign in to<br><em>your account.</em></h2>
      <p class="auth-card__lede">Enter your details below to pick up where you left off.</p>

      ${noticeBlock}
      ${errorBlock}

      <form class="auth-form" method="post" action="/login">
        <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
        <div class="field">
          <label for="email">Email address</label>
          <div class="input-wrap">
            ${icon('mail', 'input-wrap__icon')}
            <input
              id="email"
              name="email"
              type="email"
              value="${escapeHtml(email)}"
              placeholder="you@example.com"
              autocomplete="username"
              inputmode="email"
              maxlength="254"
              required
              autofocus
            >
          </div>
        </div>

        <div class="field">
          <div class="field__label-row">
            <label for="password">Password</label>
            <span class="field__hint">Minimum 8 characters</span>
          </div>
          <div class="input-wrap">
            ${icon('lock', 'input-wrap__icon')}
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Enter your password"
              autocomplete="current-password"
              maxlength="128"
              required
            >
            <button
              class="password-toggle"
              type="button"
              data-password-toggle
              aria-label="Show password"
              aria-pressed="false"
              title="Show password"
            >
              ${icon('eye', 'icon-eye')}
              ${icon('eyeOff', 'icon-eye-off')}
            </button>
          </div>
        </div>

        <button class="button button--primary" type="submit">
          <span>Sign in</span>
          <span class="button__icon">${icon('arrow')}</span>
        </button>
      </form>

      <p class="auth-switch">New here?&nbsp;<a href="/signup">Create an account</a></p>

      <div class="trust-line">
        ${icon('shield')}
        <span>Your password is checked securely and never stored as plain text.</span>
      </div>
    </div>
  `;

  return authLayout({
    title: 'Sign in',
    description: 'Sign in to your account.',
    card,
  });
}

function renderSignup({ values = {}, errors = {}, error = '', csrfToken = '' } = {}) {
  const name = values.name || '';
  const email = values.email || '';
  const nameState = fieldState(errors, 'name');
  const emailState = fieldState(errors, 'email');
  const passwordState = fieldState(errors, 'password');
  const confirmState = fieldState(errors, 'confirmPassword');
  const hasFieldErrors = Object.keys(errors).length > 0;
  const errorBlock = error
    ? alert('error', 'We could not create your account', error)
    : hasFieldErrors
      ? alert('error', 'Almost there', 'Please fix the highlighted details and try again.')
      : '';

  const card = `
    <div class="auth-card">
      <p class="eyebrow eyebrow--dark">Get started</p>
      <h2>Create your<br><em>account.</em></h2>
      <p class="auth-card__lede">A few details, one secure password, and you are in.</p>

      ${errorBlock}

      <form class="auth-form" method="post" action="/signup" data-signup-form>
        <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
        <div class="field">
          <label for="name">Full name</label>
          <div class="input-wrap">
            ${icon('user', 'input-wrap__icon')}
            <input
              class="input${nameState.className}"
              id="name"
              name="name"
              type="text"
              value="${escapeHtml(name)}"
              placeholder="Ada Lovelace"
              autocomplete="name"
              minlength="2"
              maxlength="60"
              required
              autofocus
              ${nameState.ariaInvalid}${nameState.describedBy}
            >
          </div>
          ${fieldError(errors, 'name')}
        </div>

        <div class="field">
          <label for="email">Email address</label>
          <div class="input-wrap">
            ${icon('mail', 'input-wrap__icon')}
            <input
              class="input${emailState.className}"
              id="email"
              name="email"
              type="email"
              value="${escapeHtml(email)}"
              placeholder="you@example.com"
              autocomplete="username"
              inputmode="email"
              maxlength="254"
              required
              ${emailState.ariaInvalid}${emailState.describedBy}
            >
          </div>
          ${fieldError(errors, 'email')}
        </div>

        <div class="field">
          <div class="field__label-row">
            <label for="password">Password</label>
            <span class="field__hint">8+ characters</span>
          </div>
          <div class="input-wrap">
            ${icon('lock', 'input-wrap__icon')}
            <input
              class="input${passwordState.className}"
              id="password"
              name="password"
              type="password"
              placeholder="Create a password"
              autocomplete="new-password"
              minlength="8"
              maxlength="128"
              required
              ${passwordState.ariaInvalid}${passwordState.describedBy}
            >
            <button
              class="password-toggle"
              type="button"
              data-password-toggle
              aria-label="Show password"
              aria-pressed="false"
              title="Show password"
            >
              ${icon('eye', 'icon-eye')}
              ${icon('eyeOff', 'icon-eye-off')}
            </button>
          </div>
          ${fieldError(errors, 'password')}
        </div>

        <div class="field">
          <label for="confirmPassword">Confirm password</label>
          <div class="input-wrap">
            ${icon('lock', 'input-wrap__icon')}
            <input
              class="input${confirmState.className}"
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              autocomplete="new-password"
              minlength="8"
              maxlength="128"
              required
              ${confirmState.ariaInvalid}${confirmState.describedBy}
            >
            <button
              class="password-toggle"
              type="button"
              data-password-toggle
              aria-label="Show password"
              aria-pressed="false"
              title="Show password"
            >
              ${icon('eye', 'icon-eye')}
              ${icon('eyeOff', 'icon-eye-off')}
            </button>
          </div>
          ${fieldError(errors, 'confirmPassword')}
        </div>

        <button class="button button--primary" type="submit">
          <span>Create account</span>
          <span class="button__icon">${icon('arrow')}</span>
        </button>
      </form>

      <p class="auth-switch">Already have an account?&nbsp;<a href="/login">Sign in</a></p>

      <div class="trust-line">
        ${icon('shield')}
        <span>Your password is hashed with scrypt before it touches the database.</span>
      </div>
    </div>
  `;

  return authLayout({
    title: 'Create account',
    description: 'Create a secure account.',
    card,
  });
}

function renderDashboard({ user, sessionCount = 1, created = false, csrfToken = '' }) {
  const initials = initialsFor(user.name);
  const firstName = firstNameFor(user.name);
  const createdBlock = created
    ? alert('success', 'Your account is ready', 'Welcome. This is your private account overview.')
    : '';

  const content = `
    <div class="dashboard-shell">
      <header class="dashboard-nav">
        <a class="brand brand--dark" href="/dashboard" aria-label="${BRAND_NAME} dashboard">
          <span class="brand__mark-wrap">${brandMark()}</span>
          <span class="brand__name">${BRAND_NAME}</span>
        </a>
        <div class="dashboard-nav__actions">
          <span class="nav-account">
            <span class="avatar avatar--small">${escapeHtml(initials)}</span>
            <span>${escapeHtml(user.email)}</span>
          </span>
          <form method="post" action="/logout">
            <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
            <button class="button button--quiet" type="submit">
              ${icon('signout')}
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </header>

      <main class="dashboard-main" id="main">
        ${createdBlock}

        <section class="dashboard-heading">
          <div>
            <p class="eyebrow eyebrow--dark">Account overview</p>
            <h1>Good to see you,<br><em>${escapeHtml(firstName)}.</em></h1>
            <p>Your account is signed in and your session is active.</p>
          </div>
          <span class="session-pill"><span class="status-dot"></span> Session active</span>
        </section>

        <div class="dashboard-grid">
          <section class="panel panel--account" aria-labelledby="account-title">
            <header class="panel__header">
              <div>
                <p class="panel__kicker">Profile</p>
                <h2 id="account-title">Your account</h2>
              </div>
              <span class="chip">Personal</span>
            </header>

            <div class="identity">
              <span class="avatar avatar--large">${escapeHtml(initials)}</span>
              <div>
                <h3>${escapeHtml(user.name)}</h3>
                <p>${escapeHtml(user.email)}</p>
              </div>
              <span class="verified-badge">${icon('check')} Active</span>
            </div>

            <dl class="details">
              <div>
                <dt>Email address</dt>
                <dd>${escapeHtml(user.email)}</dd>
              </div>
              <div>
                <dt>Member since</dt>
                <dd>${escapeHtml(formatDate(user.createdAt))}</dd>
              </div>
              <div>
                <dt>Account ID</dt>
                <dd>ACCT-${String(user.id).padStart(4, '0')}</dd>
              </div>
            </dl>

            <div class="panel-note">
              <span class="panel-note__icon">${icon('spark')}</span>
              <p>This page is protected. Requests without a valid session are redirected to sign in.</p>
            </div>
          </section>

          <section class="panel panel--security" aria-labelledby="security-title">
            <header class="panel__header">
              <div>
                <p class="panel__kicker">Trust &amp; access</p>
                <h2 id="security-title">Security</h2>
              </div>
              <span class="shield-badge">${icon('shield')}</span>
            </header>

            <ul class="security-list">
              <li>
                <span class="security-list__icon">${icon('lock')}</span>
                <div>
                  <strong>Password protected</strong>
                  <p>Stored as a salted scrypt hash.</p>
                </div>
                <span class="security-tag">Active</span>
              </li>
              <li>
                <span class="security-list__icon">${icon('database')}</span>
                <div>
                  <strong>SQL-backed session</strong>
                  <p>${sessionCount} active ${sessionCount === 1 ? 'session' : 'sessions'} for this account.</p>
                </div>
                <span class="security-tag">SQLite</span>
              </li>
              <li>
                <span class="security-list__icon">${icon('shield')}</span>
                <div>
                  <strong>Session expiry</strong>
                  <p>${escapeHtml(formatDateTime(new Date(user.expiresAt * 1000)))}</p>
                </div>
                <span class="security-tag">7 days</span>
              </li>
            </ul>

            <form method="post" action="/logout" class="security-signout">
              <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
              <button class="button button--outline" type="submit">
                ${icon('signout')}
                <span>Sign out of this device</span>
              </button>
            </form>
          </section>
        </div>

        <footer class="dashboard-footer">
          <span>A small, secure login system</span>
          <span>Users &amp; sessions stored in SQLite</span>
        </footer>
      </main>
    </div>
  `;

  return documentShell({
    title: 'Dashboard',
    description: 'Your private account overview.',
    bodyClass: 'page-dashboard',
    content,
  });
}

function renderError({ status = 500, title = 'Something went wrong', message = '' }) {
  const defaultMessages = {
    400: 'The request could not be understood.',
    403: 'You do not have permission to view this page.',
    404: 'The page you are looking for does not exist.',
    405: 'That request method is not allowed here.',
    413: 'The request was too large.',
    415: 'That content type is not supported.',
    429: 'Too many attempts. Please wait a moment and try again.',
    500: 'An unexpected error occurred. Please try again.',
  };

  const content = `
    <main class="error-page" id="main">
      <div class="error-card">
        <a class="brand brand--dark" href="/" aria-label="${BRAND_NAME} home">
          <span class="brand__mark-wrap">${brandMark()}</span>
          <span class="brand__name">${BRAND_NAME}</span>
        </a>
        <p class="error-code">${escapeHtml(String(status))}</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(message || defaultMessages[status] || defaultMessages[500])}</p>
        <a class="button button--primary" href="/">
          <span>Back to safety</span>
          <span class="button__icon">${icon('arrow')}</span>
        </a>
      </div>
    </main>
  `;

  return documentShell({
    title,
    description: message || defaultMessages[status] || defaultMessages[500],
    bodyClass: 'page-error',
    content,
  });
}

module.exports = {
  escapeHtml,
  renderDashboard,
  renderError,
  renderLogin,
  renderSignup,
};
