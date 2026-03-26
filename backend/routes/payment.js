const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

const PAYMENTS_FILE = path.join(__dirname, '../../data/payments.json');
const POLLS_FILE = path.join(__dirname, '../../data/polls.json');
const USERS_FILE = path.join(__dirname, '../../data/users.json');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (req, file, cb) => cb(null, `pay_${Date.now()}_${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function readPayments() {
  try { return JSON.parse(fs.readFileSync(PAYMENTS_FILE, 'utf8')); }
  catch { return []; }
}
function writePayments(p) { fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(p, null, 2)); }
function readPolls() {
  try { return JSON.parse(fs.readFileSync(POLLS_FILE, 'utf8')); }
  catch { return []; }
}
function writePolls(p) { fs.writeFileSync(POLLS_FILE, JSON.stringify(p, null, 2)); }
function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return []; }
}
function writeUsers(u) { fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); }

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  next();
}
function requireCR(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  if (req.session.role !== 'cr') return res.status(403).json({ error: 'CR only' });
  next();
}

function validateTxnId(txnId) {
  if (!txnId) return false;
  const clean = txnId.trim();
  if (clean.length < 8 || clean.length > 64) return false;
  return /^[a-zA-Z0-9_\-]+$/.test(clean);
}

function fileHash(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(buf).digest('hex');
  } catch { return null; }
}

// Submit payment
router.post('/submit-payment', requireAuth, upload.single('screenshot'), (req, res) => {
  try {
    const { pollId, transactionId, copies } = req.body;
    if (!pollId || !transactionId) return res.status(400).json({ error: 'Poll ID and Transaction ID required' });
    if (!validateTxnId(transactionId)) return res.status(400).json({ error: 'Invalid transaction ID format (8-64 alphanumeric chars)' });

    const payments = readPayments();
    const polls = readPolls();
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return res.status(404).json({ error: 'Poll not found' });

    const numCopies = parseInt(copies) || 1;
    const amount = poll.pricePerCopy * numCopies;

    // Fraud detection
    let status = 'pending';
    let fraudFlags = [];

    // Duplicate transaction ID
    const dupTxn = payments.find(p => p.transactionId === transactionId.trim());
    if (dupTxn) {
      status = 'fraud';
      fraudFlags.push('duplicate_transaction_id');
    }

    // Screenshot hash check
    let screenshotHash = null;
    if (req.file) {
      screenshotHash = fileHash(req.file.path);
      const dupHash = payments.find(p => p.screenshotHash && p.screenshotHash === screenshotHash);
      if (dupHash) {
        if (status !== 'fraud') status = 'suspicious';
        fraudFlags.push('duplicate_screenshot');
      }
    }

    // Check if already paid
    const existing = payments.find(p => p.pollId === pollId && p.userId === req.session.userId && !['rejected','fraud'].includes(p.status));
    if (existing) return res.status(409).json({ error: 'Payment already submitted for this poll' });

    const payment = {
      id: uuidv4(),
      userId: req.session.userId,
      pollId,
      transactionId: transactionId.trim(),
      amount,
      copies: numCopies,
      screenshot: req.file ? `/uploads/${req.file.filename}` : null,
      screenshotHash,
      status,
      fraudFlags,
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null
    };

    payments.push(payment);
    writePayments(payments);

    // Update participant payment status in poll
    const pollIdx = polls.findIndex(p => p.id === pollId);
    if (pollIdx !== -1) {
      const participant = polls[pollIdx].participants.find(p => p.userId === req.session.userId);
      if (participant) {
        participant.paymentStatus = status === 'fraud' ? 'fraud' : (status === 'suspicious' ? 'suspicious' : 'pending_review');
        participant.paymentId = payment.id;
      }
      writePolls(polls);
    }

    // Award on-time payer badge
    if (status === 'pending') {
      const users = readUsers();
      const user = users.find(u => u.id === req.session.userId);
      if (user) {
        if (!user.badges) user.badges = [];
        if (!user.badges.includes('on_time_payer')) {
          user.badges.push('on_time_payer');
          writeUsers(users);
        }
      }
    }

    res.json({ success: true, payment: { id: payment.id, status, fraudFlags, amount } });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Server error' }); }
});

// Get payments for a poll (CR only)
router.get('/payments/:pollId', requireCR, (req, res) => {
  const payments = readPayments();
  const users = readUsers();
  const pollPayments = payments
    .filter(p => p.pollId === req.params.pollId)
    .map(p => {
      const user = users.find(u => u.id === p.userId);
      return { ...p, userName: user ? user.name : 'Unknown', userEmail: user ? user.email : '' };
    });
  res.json(pollPayments);
});

// Get my payments
router.get('/my-payments', requireAuth, (req, res) => {
  const payments = readPayments();
  const myPayments = payments.filter(p => p.userId === req.session.userId);
  res.json(myPayments);
});

// Approve/Reject payment (CR only)
router.post('/review-payment/:id', requireCR, (req, res) => {
  const { action } = req.body;
  if (!['verified', 'rejected', 'suspicious'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
  const payments = readPayments();
  const payment = payments.find(p => p.id === req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });

  payment.status = action;
  payment.reviewedAt = new Date().toISOString();
  payment.reviewedBy = req.session.userId;
  writePayments(payments);

  // Update poll participant status
  const polls = readPolls();
  const poll = polls.find(p => p.id === payment.pollId);
  if (poll) {
    const participant = poll.participants.find(p => p.userId === payment.userId);
    if (participant) {
      participant.paymentStatus = action;
      writePolls(polls);
    }
  }

  // Award verified_payer badge
  if (action === 'verified') {
    const users = readUsers();
    const user = users.find(u => u.id === payment.userId);
    if (user) {
      if (!user.badges) user.badges = [];
      if (!user.badges.includes('verified_payer')) {
        user.badges.push('verified_payer');
        writeUsers(users);
      }
    }
  }

  res.json({ success: true });
});

// Dashboard stats
router.get('/dashboard/:pollId', requireAuth, (req, res) => {
  const payments = readPayments();
  const polls = readPolls();
  const poll = polls.find(p => p.id === req.params.pollId);
  if (!poll) return res.status(404).json({ error: 'Poll not found' });

  const pollPayments = payments.filter(p => p.pollId === req.params.pollId);
  const stats = {
    totalJoined: poll.participants.length,
    paid: pollPayments.filter(p => p.status === 'verified').length,
    pending: pollPayments.filter(p => p.status === 'pending').length,
    suspicious: pollPayments.filter(p => ['suspicious', 'fraud'].includes(p.status)).length,
    rejected: pollPayments.filter(p => p.status === 'rejected').length,
    totalCollected: pollPayments.filter(p => p.status === 'verified').reduce((s, p) => s + p.amount, 0),
    totalCopies: poll.participants.reduce((s, p) => s + (p.copies || 1), 0),
    estimatedWaitMinutes: poll.participants.length * 2,
    queueLength: poll.participants.filter(p => p.paymentStatus !== 'verified').length
  };
  res.json(stats);
});

// All polls dashboard (CR)
router.get('/dashboard', requireCR, (req, res) => {
  const payments = readPayments();
  const polls = readPolls();
  const users = readUsers();
  const stats = {
    totalPolls: polls.length,
    activePolls: polls.filter(p => p.status === 'active').length,
    totalStudents: users.filter(u => u.role === 'student').length,
    totalPayments: payments.length,
    verified: payments.filter(p => p.status === 'verified').length,
    suspicious: payments.filter(p => ['suspicious', 'fraud'].includes(p.status)).length,
    totalRevenue: payments.filter(p => p.status === 'verified').reduce((s, p) => s + p.amount, 0),
    recentPolls: polls.slice(-5).reverse()
  };
  res.json(stats);
});

// Generate report for poll
router.get('/report/:pollId', requireCR, (req, res) => {
  const payments = readPayments();
  const polls = readPolls();
  const users = readUsers();
  const poll = polls.find(p => p.id === req.params.pollId);
  if (!poll) return res.status(404).json({ error: 'Poll not found' });

  const pollPayments = payments.filter(p => p.pollId === req.params.pollId);
  const report = {
    poll: { subject: poll.subject, pricePerCopy: poll.pricePerCopy, status: poll.status, createdAt: poll.createdAt, expiryTime: poll.expiryTime },
    summary: {
      totalParticipants: poll.participants.length,
      totalRevenue: pollPayments.filter(p => p.status === 'verified').reduce((s, p) => s + p.amount, 0),
      verifiedPayments: pollPayments.filter(p => p.status === 'verified').length,
      pendingPayments: pollPayments.filter(p => p.status === 'pending').length,
      suspiciousPayments: pollPayments.filter(p => ['suspicious', 'fraud'].includes(p.status)).length,
      totalCopies: poll.participants.reduce((s, p) => s + (p.copies || 1), 0)
    },
    payments: pollPayments.map(p => {
      const user = users.find(u => u.id === p.userId);
      return { ...p, userName: user ? user.name : 'Unknown', userEmail: user ? user.email : '' };
    })
  };
  res.json(report);
});

module.exports = router;
