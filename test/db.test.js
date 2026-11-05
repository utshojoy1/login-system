'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const auth = require('../src/auth');
const { openDatabase } = require('../src/db');

test('users and sessions are stored in SQL', async (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());

  const passwordHash = await auth.hashPassword('correct-horse-9');
  const user = db.createUser({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    passwordHash,
  });

  assert.equal(user.id, 1);
  assert.equal(user.email, 'ada@example.com');

  const stored = db.findUserByEmail('ada@example.com');
  assert.equal(stored.name, 'Ada Lovelace');
  assert.equal(stored.passwordHash, passwordHash);
  assert.equal(await auth.verifyPassword('correct-horse-9', stored.passwordHash), true);

  const token = auth.createSessionToken();
  const tokenHash = auth.hashSessionToken(token);
  const expiresAt = Math.floor(Date.now() / 1000) + 60;

  db.createSession({ tokenHash, userId: user.id, expiresAt });

  const session = db.findSession(tokenHash);
  assert.equal(session.id, user.id);
  assert.equal(session.email, 'ada@example.com');
  assert.equal(session.expiresAt, expiresAt);
  assert.equal(db.countSessionsForUser(user.id), 1);

  db.deleteSession(tokenHash);
  assert.equal(db.findSession(tokenHash), null);
});

test('expired sessions cannot be loaded', async (t) => {
  const db = openDatabase(':memory:');
  t.after(() => db.close());

  const user = db.createUser({
    name: 'Grace Hopper',
    email: 'grace@example.com',
    passwordHash: await auth.hashPassword('compiler-1952'),
  });

  const tokenHash = auth.hashSessionToken(auth.createSessionToken());
  db.createSession({
    tokenHash,
    userId: user.id,
    expiresAt: Math.floor(Date.now() / 1000) - 10,
  });

  assert.equal(db.findSession(tokenHash), null);
  db.cleanupSessions();
  assert.equal(db.countSessionsForUser(user.id), 0);
});
