'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA_PATH = path.join(__dirname, '..', 'schema.sql');

function openDatabase(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

  const statements = {
    insertUser: db.prepare(`
      INSERT INTO users (name, email, password_hash)
      VALUES (?, ?, ?)
    `),
    userByEmail: db.prepare(`
      SELECT id, name, email, password_hash, created_at
      FROM users
      WHERE email = ?
    `),
    userById: db.prepare(`
      SELECT id, name, email, created_at
      FROM users
      WHERE id = ?
    `),
    insertSession: db.prepare(`
      INSERT INTO sessions (token_hash, user_id, expires_at)
      VALUES (?, ?, ?)
    `),
    sessionByHash: db.prepare(`
      SELECT
        u.id,
        u.name,
        u.email,
        u.created_at,
        s.expires_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > unixepoch()
    `),
    deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash = ?'),
    deleteExpiredSessions: db.prepare('DELETE FROM sessions WHERE expires_at <= unixepoch()'),
    countSessionsForUser: db.prepare('SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?'),
  };

  function publicUser(row) {
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      name: row.name,
      email: row.email,
      createdAt: row.created_at,
      expiresAt: row.expires_at === undefined ? null : Number(row.expires_at),
    };
  }

  return {
    close() {
      db.close();
    },

    cleanupSessions() {
      statements.deleteExpiredSessions.run();
    },

    createUser({ name, email, passwordHash }) {
      const result = statements.insertUser.run(name, email, passwordHash);
      return publicUser(statements.userById.get(Number(result.lastInsertRowid)));
    },

    findUserByEmail(email) {
      const row = statements.userByEmail.get(email);
      if (!row) {
        return null;
      }

      return {
        ...publicUser(row),
        passwordHash: row.password_hash,
      };
    },

    createSession({ tokenHash, userId, expiresAt }) {
      statements.insertSession.run(tokenHash, userId, expiresAt);
    },

    findSession(tokenHash) {
      return publicUser(statements.sessionByHash.get(tokenHash));
    },

    deleteSession(tokenHash) {
      statements.deleteSession.run(tokenHash);
    },

    countSessionsForUser(userId) {
      return Number(statements.countSessionsForUser.get(userId).count);
    },
  };
}

module.exports = { openDatabase };
