const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../db');
const {
  hashPassword,
  verifyPassword,
  signSessionToken,
  verifySessionToken,
  validateSignupInput,
} = require('../../api/_lib/auth');

test('Auth: salted scrypt hashing and HMAC session tokens', () => {
  const hash = hashPassword('SuperSecret123!');
  assert.ok(hash.includes(':'));
  assert.equal(verifyPassword('SuperSecret123!', hash), true);
  assert.equal(verifyPassword('WrongPassword!', hash), false);

  const token = signSessionToken({
    id: 'usr_abc123',
    username: 'VandanPro',
    email: 'vandan@example.com',
  });
  const payload = verifySessionToken(token);
  assert.equal(payload.id, 'usr_abc123');
  assert.equal(payload.username, 'VandanPro');
  assert.equal(payload.email, 'vandan@example.com');

  // Tampered token must fail
  assert.equal(verifySessionToken(`${token}x`), null);
});

test('Auth: registerUser starts at $0.00, rejects duplicates, authenticates email or username', () => {
  const db = createDatabase(':memory:');
  try {
    const clean = validateSignupInput({
      username: 'VandanPro',
      email: 'Vandan@Example.com',
      password: 'password123',
    });
    const hash = hashPassword(clean.password);
    const created = db.registerUser({
      username: clean.username,
      email: clean.email,
      passwordHash: hash,
    });

    assert.equal(created.username, 'VandanPro');
    assert.equal(created.email, 'vandan@example.com');
    assert.equal(created.balanceCents, 0);

    // Duplicate email rejected
    assert.throws(
      () =>
        db.registerUser({
          username: 'AnotherHandle',
          email: 'vandan@example.com',
          passwordHash: hash,
        }),
      /email already exists/i
    );

    // Duplicate username rejected
    assert.throws(
      () =>
        db.registerUser({
          username: 'vandanpro',
          email: 'other@example.com',
          passwordHash: hash,
        }),
      /username is already taken/i
    );

    // Login by email
    const byEmail = db.findAuthUser('VANDAN@example.com');
    assert.ok(byEmail);
    assert.equal(verifyPassword('password123', byEmail.passwordHash), true);
    assert.equal(verifyPassword('badpass', byEmail.passwordHash), false);

    // Login by username
    const byUsername = db.findAuthUser('vandanpro');
    assert.ok(byUsername);
    assert.equal(byUsername.user.id, created.id);
  } finally {
    db.close();
  }
});
