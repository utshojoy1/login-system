'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const auth = require('../src/auth');

test('passwords are salted, hashed, and verifiable', async () => {
  const first = await auth.hashPassword('correct-horse-battery');
  const second = await auth.hashPassword('correct-horse-battery');

  assert.match(first, /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.notEqual(first, second, 'each password hash should have a unique salt');
  assert.equal(first.includes('correct-horse-battery'), false, 'the plain password must not be stored');
  assert.equal(await auth.verifyPassword('correct-horse-battery', first), true);
  assert.equal(await auth.verifyPassword('wrong-password', first), false);
});

test('malformed or unsupported hashes fail closed', async () => {
  assert.equal(await auth.verifyPassword('anything', ''), false);
  assert.equal(await auth.verifyPassword('anything', 'not-a-hash'), false);
  assert.equal(await auth.verifyPassword('anything', 'argon2$1$salt$hash'), false);
  assert.equal(
    await auth.verifyPassword('anything', 'scrypt$999999999$8$1$c2FsdA$aGFzaA'),
    false,
  );
});

test('signup validation reports field-level errors', () => {
  const result = auth.validateSignup({
    name: 'A',
    email: 'not-an-email',
    password: 'short',
    confirmPassword: 'different',
  });

  assert.deepEqual(Object.keys(result.errors).sort(), [
    'confirmPassword',
    'email',
    'name',
    'password',
  ]);
});

test('valid signup details are normalized', () => {
  const result = auth.validateSignup({
    name: '  Ada   Lovelace  ',
    email: auth.normalizeEmail('  Ada@Example.COM '),
    password: 'correct-horse-9',
    confirmPassword: 'correct-horse-9',
  });

  assert.deepEqual(result.errors, {});
  assert.deepEqual(result.values, {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
  });
});

test('session tokens are random and only their hash is persisted', () => {
  const first = auth.createSessionToken();
  const second = auth.createSessionToken();
  const hash = auth.hashSessionToken(first);

  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, first);
});
