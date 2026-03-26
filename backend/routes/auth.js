const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '../../data/users.json');

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return []; }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields required' });
    const users = readUsers();
    if (users.find(u => u.email === email)) return res.status(409).json({ error: 'Email already registered' });
    const hashed = await bcrypt.hash(password, 10);
    const user = { id: uuidv4(), name, email, password: hashed, role, createdAt: new Date().toISOString(), badges: [] };
    users.push(user);
    writeUsers(users);
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const users = readUsers();
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// Google Login (simulated - in production use Firebase Admin SDK)
router.post('/google-login', async (req, res) => {
  try {
    const { email, name, googleId, role } = req.body;
    if (!email || !name) return res.status(400).json({ error: 'Missing Google profile data' });
    const users = readUsers();
    let user = users.find(u => u.email === email);
    if (!user) {
      user = { id: uuidv4(), name, email, password: null, googleId, role: role || 'student', createdAt: new Date().toISOString(), badges: [] };
      users.push(user);
      writeUsers(users);
    }
    req.session.userId = user.id;
    req.session.role = user.role;
    res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Get current user
router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  const users = readUsers();
  const user = users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, badges: user.badges || [] });
});

module.exports = router;
