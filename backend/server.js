require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure directories exist
['data', 'uploads'].forEach(dir => {
  const p = path.join(__dirname, '..', dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});
['users.json', 'polls.json', 'payments.json'].forEach(file => {
  const p = path.join(__dirname, '../data', file);
  if (!fs.existsSync(p)) fs.writeFileSync(p, '[]');
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'printshop-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Static files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/poll'));
app.use('/api', require('./routes/payment'));

// SPA fallback
app.use((req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }
});

app.post('/api/google-login', (req, res) => {
  const { name, email, googleId } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  // 🔥 Create user (or find existing)
  const user = {
    id: googleId,
    name,
    email,
    role: 'student'
  };

  // ✅ Save session (IMPORTANT)
  req.session.user = user;

  // ✅ Return JSON
  res.json({ user });
});

app.listen(PORT, () => console.log(`PrintShop running on http://localhost:${PORT}`));
