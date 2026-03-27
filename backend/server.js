require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'printshop',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Auth Middleware
function verifyAuth(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ============================================================
// AUTHENTICATION ENDPOINTS
// ============================================================
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const conn = await pool.getConnection();
    const [users] = await conn.query('SELECT * FROM users WHERE email = ?', [email]);
    conn.release();
    
    if (!users.length) return res.status(400).json({ error: 'Invalid credentials' });
    
    const user = users[0];
    const validPwd = await bcrypt.compare(password, user.password);
    if (!validPwd) return res.status(400).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const conn = await pool.getConnection();
    
    const hashedPwd = await bcrypt.hash(password, 10);
    const userId = require('crypto').randomUUID();
    
    await conn.query('INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)', 
      [userId, name, email, hashedPwd, role || 'student']);
    
    const token = jwt.sign({ id: userId, email, role }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    conn.release();
    
    res.json({
      user: { id: userId, name, email, role },
      token
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/me', verifyAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [users] = await conn.query('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id]);
    conn.release();
    
    if (!users.length) return res.status(404).json({ error: 'User not found' });
    res.json({ user: users[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// POLLS ENDPOINTS
// ============================================================
app.get('/api/polls', verifyAuth, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [polls] = await conn.query(`
      SELECT p.*, 
             JSON_ARRAYAGG(JSON_OBJECT('userId', part.userId, 'queuePosition', part.queuePosition, 'paymentStatus', part.paymentStatus, 'copies', part.copies)) as participants
      FROM polls p
      LEFT JOIN participants part ON p.id = part.pollId
      WHERE p.status = 'active'
      GROUP BY p.id
      ORDER BY p.expiryTime ASC
    `);
    conn.release();
    
    // Parse JSON participants
    const formattedPolls = polls.map(p => ({
      ...p,
      participants: p.participants && p.participants !== '[null]' ? JSON.parse(p.participants).filter(x => x.userId) : []
    }));
    
    res.json(formattedPolls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/join-poll', verifyAuth, async (req, res) => {
  try {
    const { pollId, copies } = req.body;
    const userId = req.user.id;
    const conn = await pool.getConnection();
    
    // Check poll exists and is active
    const [polls] = await conn.query('SELECT * FROM polls WHERE id = ? AND status = ?', [pollId, 'active']);
    if (!polls.length) {
      conn.release();
      return res.status(400).json({ error: 'Poll not active' });
    }
    
    // Check expiry (FEATURE #5)
    if (new Date(polls[0].expiryTime) < new Date()) {
      conn.release();
      return res.status(400).json({ error: 'Poll expired' });
    }
    
    // Check already joined (FEATURE #10)
    const [existing] = await conn.query('SELECT * FROM participants WHERE pollId = ? AND userId = ?', [pollId, userId]);
    if (existing.length) {
      conn.release();
      return res.status(400).json({ error: 'Already joined' });
    }
    
    // Get queue position
    const [[{ cnt }]] = await conn.query('SELECT COUNT(*) as cnt FROM participants WHERE pollId = ?', [pollId]);
    const queuePosition = cnt + 1;
    
    await conn.query('INSERT INTO participants (pollId, userId, copies, queuePosition) VALUES (?, ?, ?, ?)', 
      [pollId, userId, copies, queuePosition]);
    
    conn.release();
    res.json({ success: true, queuePosition });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ORDERS ENDPOINTS (NEW - FEATURE #2)
// ============================================================
app.get('/api/my-orders', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const conn = await pool.getConnection();
    const [orders] = await conn.query(
      'SELECT * FROM orders WHERE userId = ? ORDER BY date DESC',
      [userId]
    );
    conn.release();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PAYMENT ENDPOINTS
// ============================================================
app.post('/api/submit-payment', verifyAuth, async (req, res) => {
  try {
    const { pollId } = req.body;
    const userId = req.user.id;
    const conn = await pool.getConnection();
    
    await conn.query(
      'UPDATE participants SET paymentStatus = ?, paymentSubmittedAt = ? WHERE pollId = ? AND userId = ?',
      ['pending', new Date(), pollId, userId]
    );
    
    conn.release();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/my-payments', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const conn = await pool.getConnection();
    const [payments] = await conn.query(
      'SELECT * FROM payments WHERE userId = ? ORDER BY timestamp DESC LIMIT 20',
      [userId]
    );
    conn.release();
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DASHBOARD ENDPOINTS (FEATURE #7)
// ============================================================
app.get('/api/dashboard', verifyAuth, async (req, res) => {
  try {
    if (req.user.role !== 'cr') return res.status(403).json({ error: 'Forbidden' });
    
    const crId = req.user.id;
    const conn = await pool.getConnection();
    const [stats] = await conn.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN p.status = 'verified' THEN p.amount ELSE 0 END), 0) as totalRevenue,
        COUNT(DISTINCT part.userId) as totalParticipants,
        SUM(CASE WHEN p.status = 'suspicious' THEN 1 ELSE 0 END) as suspicious
      FROM polls polls
      LEFT JOIN participants part ON polls.id = part.pollId
      LEFT JOIN payments p ON part.userId = p.userId AND polls.id = p.pollId
      WHERE polls.crId = ?
    `, [crId]);
    
    conn.release();
    res.json(stats[0] || { totalRevenue: 0, totalParticipants: 0, suspicious: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ERROR HANDLING
// ============================================================
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🖨️ PrintShop server running on port ${PORT}`);
});
