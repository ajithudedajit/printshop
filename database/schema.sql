-- Create databases and tables for PrintShop

CREATE DATABASE IF NOT EXISTS printshop;
USE printshop;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('student', 'cr') DEFAULT 'student',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Polls table
CREATE TABLE IF NOT EXISTS polls (
  id VARCHAR(36) PRIMARY KEY,
  crId VARCHAR(36) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  pricePerCopy DECIMAL(10, 2) NOT NULL,
  totalPages INT,
  expiryTime TIMESTAMP NOT NULL,
  qrImage LONGTEXT,
  status ENUM('active', 'expired', 'closed') DEFAULT 'active',
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (crId) REFERENCES users(id)
);

-- Participants table
CREATE TABLE IF NOT EXISTS participants (
  id VARCHAR(36) PRIMARY KEY,
  pollId VARCHAR(36) NOT NULL,
  userId VARCHAR(36) NOT NULL,
  copies INT DEFAULT 1,
  queuePosition INT,
  paymentStatus VARCHAR(50) DEFAULT 'pending',
  paymentSubmittedAt TIMESTAMP NULL,
  joinedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pollId) REFERENCES polls(id),
  FOREIGN KEY (userId) REFERENCES users(id),
  UNIQUE KEY unique_participant (pollId, userId)
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  pollId VARCHAR(36) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'verified', 'suspicious', 'fraud') DEFAULT 'pending',
  paymentMethod VARCHAR(50),
  transactionId VARCHAR(100),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (pollId) REFERENCES polls(id)
);

-- Orders table (NEW - for order tracking)
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY,
  userId VARCHAR(36) NOT NULL,
  pollId VARCHAR(36) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  copies INT DEFAULT 1,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('pending', 'printing', 'ready', 'delivered') DEFAULT 'pending',
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (pollId) REFERENCES polls(id)
);

-- Create indexes for better query performance
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_poll_expiry ON polls(expiryTime);
CREATE INDEX idx_poll_status ON polls(status);
CREATE INDEX idx_participant_poll ON participants(pollId);
CREATE INDEX idx_participant_user ON participants(userId);
CREATE INDEX idx_payment_user ON payments(userId);
CREATE INDEX idx_order_user ON orders(userId);
