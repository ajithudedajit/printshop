# 🖨️ PrintShop: Campus Bulk-Order & Queue Manager

A full-stack PWA for managing campus print jobs with secure payments, fraud detection, and smart queue management.

## 🚀 Quick Start

```bash
npm install
node backend/server.js
```

Open http://localhost:3000

## 👥 Demo Accounts

After first signup, create:
- **CR account**: role = "Class Representative"
- **Student account**: role = "Student"

## 📱 PWA Installation

Open in mobile browser → "Add to Home Screen" → Install

## 🔑 Features

- ✅ Email/Password + Google OAuth login
- ✅ CR Dashboard: Create polls, approve payments
- ✅ Student: Join polls, submit payments
- ✅ Transaction ID validation & fraud detection
- ✅ Duplicate screenshot detection
- ✅ Real-time countdowns
- ✅ PWA installable (offline support)
- ✅ Dark/Light mode
- ✅ Mobile-first Tailwind UI
- ✅ Chart.js analytics
- ✅ Badge gamification
- ✅ Auto-generated reports

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, express-session
- **Frontend**: HTML, Tailwind CSS (CDN), Vanilla JS
- **Storage**: JSON files (data/)
- **File uploads**: Multer
- **PWA**: manifest.json + service-worker.js
- **Charts**: Chart.js

## 📁 Structure

```
printshop/
├── backend/
│   ├── server.js
│   └── routes/
│       ├── auth.js      # Login, signup, Google OAuth
│       ├── poll.js      # Poll CRUD
│       └── payment.js   # Payments + fraud detection
├── frontend/
│   ├── index.html       # SPA with all pages
│   ├── app.js           # Application logic
│   ├── manifest.json    # PWA manifest
│   ├── service-worker.js
│   └── icons/
├── data/
│   ├── users.json
│   ├── polls.json
│   └── payments.json
└── uploads/             # QR codes + screenshots
```

## 🌐 Deployment

### Replit
1. Upload project
2. Set run command: `npm install && node backend/server.js`
3. Add `.env` secrets in Replit Secrets

### Vercel
1. `npm install -g vercel`
2. `vercel --prod`
3. Add environment variables in Vercel dashboard

## 🔒 Fraud Detection

- **Duplicate TXN ID** → Status: `fraud`
- **Duplicate screenshot hash** → Status: `suspicious`
- **Format validation** → 8-64 alphanumeric chars only
- **CR review panel** → Approve/Reject/Flag

## 🏆 Badges

- 🐦 **Early Bird**: Joined in first 3 students
- ⚡ **On-Time Payer**: Submitted payment promptly
- ✅ **Verified Payer**: Payment verified by CR
