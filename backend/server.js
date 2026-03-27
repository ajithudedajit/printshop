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
// Add these endpoints to support the new frontend features

// GET /api/my-orders - Fetch user's orders
app.get('/api/my-orders', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await db.query(
      'SELECT * FROM orders WHERE userId = ? ORDER BY date DESC',
      [userId]
    );
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/submit-payment - Submit payment proof
app.post('/api/submit-payment', verifyAuth, async (req, res) => {
  try {
    const { pollId, timestamp } = req.body;
    const userId = req.user.id;
    
    await db.query(
      'UPDATE participants SET paymentStatus = ?, paymentSubmittedAt = ? WHERE pollId = ? AND userId = ?',
      ['pending', new Date(), pollId, userId]
    );
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/my-payments - Fetch user's payment history
app.get('/api/my-payments', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const payments = await db.query(
      'SELECT * FROM payments WHERE userId = ? ORDER BY timestamp DESC',
      [userId]
    );
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard - CR dashboard stats (FEATURE #7)
app.get('/api/dashboard', verifyAuth, async (req, res) => {
  try {
    if (req.user.role !== 'cr') return res.status(403).json({ error: 'Forbidden' });
    
    const crId = req.user.id;
    const stats = await db.query(`
      SELECT 
        SUM(p.amount) as totalRevenue,
        COUNT(DISTINCT part.userId) as totalParticipants,
        SUM(CASE WHEN p.status = 'suspicious' THEN 1 ELSE 0 END) as suspicious
      FROM polls 
      LEFT JOIN participants part ON polls.id = part.pollId
      LEFT JOIN payments p ON part.id = p.participantId
      WHERE polls.crId = ?
    `, [crId]);
    
    res.json(stats[0] || { totalRevenue: 0, totalParticipants: 0, suspicious: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/polls - Fetch all active polls
app.get('/api/polls', verifyAuth, async (req, res) => {
  try {
    const polls = await db.query(`
      SELECT * FROM polls 
      WHERE status = 'active' 
      ORDER BY expiryTime ASC
    `);
    res.json(polls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/join-poll - Join a poll (with duplicate check)
app.post('/api/join-poll', verifyAuth, async (req, res) => {
  try {
    const { pollId, copies } = req.body;
    const userId = req.user.id;
    
    // Check if poll exists and is active
    const poll = await db.query('SELECT * FROM polls WHERE id = ? AND status = ?', [pollId, 'active']);
    if (!poll.length) return res.status(400).json({ error: 'Poll not found or expired' });
    
    // Check if already joined (FEATURE #10)
    const existing = await db.query('SELECT * FROM participants WHERE pollId = ? AND userId = ?', [pollId, userId]);
    if (existing.length) return res.status(400).json({ error: 'Already joined this poll' });
    
    // Check expiry (FEATURE #5)
    if (new Date(poll[0].expiryTime) < new Date()) {
      return res.status(400).json({ error: 'Poll has expired' });
    }
    
    // Get queue position
    const count = await db.query('SELECT COUNT(*) as cnt FROM participants WHERE pollId = ?', [pollId]);
    const queuePosition = count[0].cnt + 1;
    
    await db.query(
      'INSERT INTO participants (pollId, userId, copies, queuePosition) VALUES (?, ?, ?, ?)',
      [pollId, userId, copies, queuePosition]
    );
    
    res.json({ success: true, queuePosition });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
