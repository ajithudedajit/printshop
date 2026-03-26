const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const POLLS_FILE = path.join(__dirname, '../../data/polls.json');
const USERS_FILE = path.join(__dirname, '../../data/users.json');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, `qr_${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function readPolls() {
  try { return JSON.parse(fs.readFileSync(POLLS_FILE, 'utf8')); }
  catch { return []; }
}
function writePolls(polls) {
  fs.writeFileSync(POLLS_FILE, JSON.stringify(polls, null, 2));
}
function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return []; }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}
function requireCR(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  if (req.session.role !== 'cr') return res.status(403).json({ error: 'CR only' });
  next();
}

// Create poll (CR only)
router.post('/create-poll', requireCR, upload.single('qrImage'), (req, res) => {
  try {
    const { subject, pricePerCopy, expiryMinutes, description, totalPages } = req.body;
    if (!subject || !pricePerCopy || !expiryMinutes) return res.status(400).json({ error: 'Missing required fields' });
    const polls = readPolls();
    const expiryTime = new Date(Date.now() + parseInt(expiryMinutes) * 60 * 1000).toISOString();
    const poll = {
      id: uuidv4(),
      subject,
      pricePerCopy: parseFloat(pricePerCopy),
      totalPages: parseInt(totalPages) || 0,
      description: description || '',
      expiryTime,
      createdAt: new Date().toISOString(),
      createdBy: req.session.userId,
      qrImage: req.file ? `/uploads/${req.file.filename}` : null,
      participants: [],
      status: 'active'
    };
    polls.push(poll);
    writePolls(polls);
    res.json({ success: true, poll });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Get all polls
router.get('/polls', requireAuth, (req, res) => {
  const polls = readPolls();
  const now = new Date();
  const updated = polls.map(p => {
    if (p.status === 'active' && new Date(p.expiryTime) < now) p.status = 'expired';
    return p;
  });
  writePolls(updated);
  res.json(updated);
});

// Get single poll
router.get('/polls/:id', requireAuth, (req, res) => {
  const polls = readPolls();
  const poll = polls.find(p => p.id === req.params.id);
  if (!poll) return res.status(404).json({ error: 'Poll not found' });
  res.json(poll);
});

// Join poll
router.post('/join-poll', requireAuth, (req, res) => {
  try {
    const { pollId, copies } = req.body;
    if (!pollId) return res.status(400).json({ error: 'Poll ID required' });
    const polls = readPolls();
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return res.status(404).json({ error: 'Poll not found' });
    if (poll.status !== 'active') return res.status(400).json({ error: 'Poll is not active' });
    if (new Date(poll.expiryTime) < new Date()) return res.status(400).json({ error: 'Poll has expired' });
    const existing = poll.participants.find(p => p.userId === req.session.userId);
    if (existing) return res.status(409).json({ error: 'Already joined this poll' });
    const numCopies = parseInt(copies) || 1;
    poll.participants.push({
      userId: req.session.userId,
      copies: numCopies,
      joinedAt: new Date().toISOString(),
      paymentStatus: 'pending',
      queuePosition: poll.participants.length + 1
    });
    writePolls(polls);

    // Award early bird badge
    const users = readUsers();
    const user = users.find(u => u.id === req.session.userId);
    if (user && poll.participants.length <= 3) {
      if (!user.badges) user.badges = [];
      if (!user.badges.includes('early_bird')) {
        user.badges.push('early_bird');
        writeUsers(users);
      }
    }
    res.json({ success: true, queuePosition: poll.participants.length });
  } catch (e) { res.status(500).json({ error: 'Server error' }); }
});

// Close poll (CR only)
router.post('/close-poll/:id', requireCR, (req, res) => {
  const polls = readPolls();
  const poll = polls.find(p => p.id === req.params.id);
  if (!poll) return res.status(404).json({ error: 'Poll not found' });
  poll.status = 'closed';
  poll.closedAt = new Date().toISOString();
  writePolls(polls);
  res.json({ success: true });
});

module.exports = router;
