const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const db = require('../db');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, role: user.role, department_id: user.department_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, department_id: u.department_id };
}

// Citizens self-register. Officer/admin accounts are provisioned by seeding (see db.js) —
// mirrors how real municipal staff accounts are usually created by an admin, not self-signup.
router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  const id = 'user-' + uuid();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, department_id)
    VALUES (?, ?, ?, ?, 'citizen', NULL)
  `).run(id, name, email.toLowerCase(), hash);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', verifyToken, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
